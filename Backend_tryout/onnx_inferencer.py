# onnx_inferencer.py
import os
import numpy as np
import onnxruntime as ort

class ONNXModelManager:
    def __init__(self, model_dir="onnx_models"):
        self.models = {}
        self.model_dir = model_dir
        self.session_options = ort.SessionOptions()
        self.providers = ["DmlExecutionProvider", "CPUExecutionProvider"]

        for file in os.listdir(model_dir):
            if file.endswith(".onnx"):
                name = file.replace(".onnx", "")
                path = os.path.join(model_dir, file)
                self.models[name] = ort.InferenceSession(path, sess_options=self.session_options, providers=self.providers)

    def predict(self, model_name, input_array):
        session = self.models.get(model_name)
        if not session:
            raise ValueError(f"Model {model_name} not found")

        input_name = session.get_inputs()[0].name
        output = session.run(None, {input_name: input_array.astype(np.float32)})
        return output[0]

