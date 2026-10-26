import client from "./client";

export const modelsApi = {
  metrics: () => client.get("/models/metrics"),
  featureImportance: () => client.get("/models/feature-importance"),
};

export default modelsApi;
