import { api } from './client';

export interface DiscussionComment {
  id: string;
  caseId: string;
  content: string;
  mentionedUserIds: string[];
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  parentId: string | null;
  authorId: string;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchCaseDiscussions(caseId: string): Promise<DiscussionComment[]> {
  return api.get<DiscussionComment[]>(`/api/cases/${caseId}/discussions`);
}

export async function createDiscussion(
  caseId: string,
  dto: { content: string; mentionedUserIds?: string[]; parentId?: string },
): Promise<DiscussionComment> {
  return api.post<DiscussionComment>(`/api/cases/${caseId}/discussions`, dto);
}

export async function resolveDiscussion(
  caseId: string,
  discussionId: string,
  resolved: boolean,
): Promise<DiscussionComment> {
  return api.patch<DiscussionComment>(`/api/cases/${caseId}/discussions/${discussionId}/resolve`, { resolved });
}

export async function deleteDiscussion(caseId: string, discussionId: string): Promise<void> {
  return api.delete<void>(`/api/cases/${caseId}/discussions/${discussionId}`);
}
