import client from "./client";

export const analyticsApi = {
  summary: () => client.get("/analytics/summary"),
  fraudOverTime: (params = {}) => client.get("/analytics/fraud-over-time", { params }),
  riskDistribution: () => client.get("/analytics/risk-distribution"),
  topRisky: (params = {}) => client.get("/analytics/top-risky", { params }),
};

export default analyticsApi;
