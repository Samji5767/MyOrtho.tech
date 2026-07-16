import { Module } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { CopilotController } from './copilot.controller';
import { AuthModule } from '../auth/auth.module';
import { MlopsModule } from '../mlops/mlops.module';
import { EmbeddingService } from './rag/embedding.service';
import { VectorStoreService } from './rag/vector-store.service';
import { LlmService } from './rag/llm.service';
import { AgentRouterService } from './rag/agent-router.service';
import { ContextBuilderService } from './rag/context-builder.service';
import { KnowledgeIndexerService } from './rag/knowledge-indexer.service';

@Module({
  imports: [AuthModule, MlopsModule],
  providers: [
    EmbeddingService,
    VectorStoreService,
    LlmService,
    AgentRouterService,
    ContextBuilderService,
    KnowledgeIndexerService,
    CopilotService,
  ],
  controllers: [CopilotController],
})
export class CopilotModule {}
