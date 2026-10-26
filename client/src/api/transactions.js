import client from "./client";

export const transactionsApi = {
  list: (params = {}) => client.get("/transactions", { params }),
  get: (id) => client.get(`/transactions/${encodeURIComponent(id)}`),
};

export default transactionsApi;
