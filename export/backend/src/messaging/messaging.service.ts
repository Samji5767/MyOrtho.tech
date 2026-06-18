import { Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'placeholder'
  );

  async createConversation(caseId: string, participantIds: string[]): Promise<any> {
    this.logger.log(`Creating conversation for case ${caseId} with participants ${participantIds.join(',')}`);
    
    // 1. Insert conversation
    const { data: conversation, error: convError } = await this.supabase
      .from('conversations')
      .insert({ case_id: caseId })
      .select()
      .single();

    if (convError || !conversation) {
      throw new Error(`Failed to create conversation: ${convError?.message}`);
    }

    // 2. Insert participants
    const participantsData = participantIds.map((profileId) => ({
      conversation_id: conversation.id,
      profile_id: profileId,
    }));

    const { error: partError } = await this.supabase
      .from('participants')
      .insert(participantsData);

    if (partError) {
      throw new Error(`Failed to add participants: ${partError.message}`);
    }

    return conversation;
  }

  async getConversationsForUser(userId: string): Promise<any[]> {
    this.logger.log(`Fetching conversations for user: ${userId}`);

    // Query conversations where user is a participant
    const { data: participations, error } = await this.supabase
      .from('participants')
      .select('conversation_id, conversations(*)')
      .eq('profile_id', userId);

    if (error) {
      this.logger.error(`Error fetching user conversations: ${error.message}`);
      return [];
    }

    return participations.map(p => p.conversations);
  }

  async getMessages(conversationId: string): Promise<any[]> {
    this.logger.log(`Fetching messages for conversation: ${conversationId}`);

    const { data: messages, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Error fetching messages: ${error.message}`);
      return [];
    }

    return messages;
  }

  async saveMessage(
    conversationId: string,
    senderId: string,
    text: string,
    attachmentUrl?: string
  ): Promise<any> {
    this.logger.log(`Saving message in conversation ${conversationId} from sender ${senderId}`);

    const { data: message, error } = await this.supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        text,
        attachment_url: attachmentUrl || null,
      })
      .select()
      .single();

    if (error || !message) {
      throw new Error(`Failed to save message: ${error?.message}`);
    }

    return message;
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<boolean> {
    this.logger.log(`Marking messages as read in conversation ${conversationId} for user ${userId}`);

    // Mark all messages in the conversation that are NOT sent by the current user as read
    const { error } = await this.supabase
      .from('messages')
      .update({ read_status: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);

    if (error) {
      this.logger.error(`Error marking messages as read: ${error.message}`);
      return false;
    }

    return true;
  }
}
