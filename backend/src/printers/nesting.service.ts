import { Injectable, Logger } from '@nestjs/common';

export interface AlignerModelBoundingBox {
  id: string;
  width: number;  // x size in mm
  length: number; // y size in mm
  height: number; // z size in mm
}

export interface PlacedModel {
  modelId: string;
  x: number;
  y: number;
  rotationDegrees: number;
}

@Injectable()
export class NestingService {
  private readonly logger = new Logger(NestingService.name);

  /**
   * Pack multiple model bounding boxes onto a target build platform (e.g. Formlabs 140x80mm platform)
   * Bottom-Left-Fill heuristic packing
   */
  optimizeTrayLayout(
    models: AlignerModelBoundingBox[],
    platformWidth: number = 140, // mm
    platformLength: number = 80   // mm
  ): { placed: PlacedModel[]; failedToPlace: string[] } {
    this.logger.log(`Nesting: Packing ${models.length} model boundaries on ${platformWidth}x${platformLength}mm tray.`);
    
    // Sort models by area descending to optimize packing
    const sorted = [...models].sort((a, b) => (b.width * b.length) - (a.width * a.length));
    const placed: PlacedModel[] = [];
    const failedToPlace: string[] = [];

    // Occupied area tracking representation: keep it simple for the layout packer
    // Tracks placed bounding boxes
    const placedBoxes: { x1: number; y1: number; x2: number; y2: number }[] = [];

    for (const model of sorted) {
      let placedSuccess = false;

      // Try spacing coordinate steps across build plate
      for (let y = 0; y <= platformLength - model.length; y += 5) {
        for (let x = 0; x <= platformWidth - model.width; x += 5) {
          
          // Check collision overlaps
          const intersects = placedBoxes.some(b => {
            return !(x + model.width <= b.x1 || 
                     x >= b.x2 || 
                     y + model.length <= b.y1 || 
                     y >= b.y2);
          });

          if (!intersects) {
            placed.push({
              modelId: model.id,
              x,
              y,
              rotationDegrees: 0
            });
            placedBoxes.push({
              x1: x,
              y1: y,
              x2: x + model.width,
              y2: y + model.length
            });
            placedSuccess = true;
            break;
          }
        }
        if (placedSuccess) break;
      }

      if (!placedSuccess) {
        failedToPlace.push(model.id);
      }
    }

    return { placed, failedToPlace };
  }

  calculateResinForecast(placedModelsCount: number, modelAverageVolumeMl: number = 14.5): number {
    // Forecast total resin consumption plus a 10% safety buffer for build support structures
    const rawVolume = placedModelsCount * modelAverageVolumeMl;
    return rawVolume * 1.10;
  }
}
