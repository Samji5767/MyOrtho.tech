import logging
from typing import Optional

logger = logging.getLogger("ai-engine.remote_monitoring")


class RemoteMonitoringEngine:
    """
    Remote patient monitoring via photo analysis.

    Status: NOT IMPLEMENTED — photo-based aligner tracking requires a trained
    CNN model (ResNet / EfficientNet fine-tuned on labelled aligner photos).
    No model checkpoint is bundled. This endpoint raises NotImplementedError
    until a trained model is available and loaded.

    Integration path:
      1. Train or fine-tune a classification model on labelled intraoral aligner photos.
      2. Export to ONNX or TorchScript.
      3. Load in __init__ with self.model = load_model(REMOTE_MONITORING_CHECKPOINT).
      4. Set self.weights_loaded = True.
      5. Implement _preprocess_photos() and _run_inference() and re-enable
         analyze_patient_photos().
    """

    def __init__(self):
        self.weights_loaded: bool = False

    def analyze_patient_photos(self, photo_urls: list) -> dict:
        """
        Analyse intraoral patient photos to assess aligner fit and attachment integrity.
        Raises NotImplementedError until a trained model is integrated.
        """
        if not self.weights_loaded:
            raise NotImplementedError(
                "Remote monitoring photo analysis requires a trained CNN model. "
                "No model checkpoint is currently loaded. "
                "Use the manual review workflow instead."
            )

        # When weights are loaded, replace this block with real inference:
        # images = self._preprocess_photos(photo_urls)
        # predictions = self.model(images)
        # return self._format_predictions(predictions)
        raise NotImplementedError("Inference pipeline not yet implemented.")
