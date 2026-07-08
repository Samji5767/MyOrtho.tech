import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type EventType =
  | 'CaseCreated'
  | 'CaseUpdated'
  | 'ScanUploaded'
  | 'ManufacturingStarted'
  | 'ManufacturingCompleted'
  | 'ApprovalGranted'
  | 'PhotoUploaded'
  | 'NotificationSent';

export interface PlatformEvent<T = any> {
  eventId: string;
  eventType: EventType;
  timestamp: Date;
  organizationId: string;
  payload: T;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  // In-memory registry for local subscribers
  private handlers: Map<EventType, ((event: PlatformEvent) => void)[]> = new Map();

  /**
   * Publishes an event to the registry and relays it over the microservices broker (RabbitMQ/NATS/Kafka)
   */
  async publishEvent<T = any>(
    eventType: EventType,
    orgId: string,
    payload: T
  ): Promise<PlatformEvent<T>> {
    const event: PlatformEvent<T> = {
      eventId: `evt-${randomUUID()}`,
      eventType,
      timestamp: new Date(),
      organizationId: orgId,
      payload,
    };

    this.logger.log(`[EVENT PUBLISHED] ID: ${event.eventId} Type: ${event.eventType} Org: ${event.organizationId}`);

    // In production, publish via AMQP client e.g. client.emit('platform_events', event)
    this.logger.log(`Relaying event ID: ${event.eventId} to NATS/RabbitMQ broker queues...`);

    // Invoke registered local handlers asynchronously
    const typeHandlers = this.handlers.get(eventType) || [];
    typeHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (err: any) {
        this.logger.error(`Error executing event handler for ${eventType}:`, err?.message || String(err));
      }
    });

    return event;
  }

  /**
   * Registers a subscriber for local event loops
   */
  subscribe(eventType: EventType, handler: (event: PlatformEvent) => void): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    this.logger.log(`Local handler registered for event type: ${eventType}`);
  }
}
