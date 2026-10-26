import client from "./client";

export const investigationsApi = {
  list: (params = {}) => client.get("/investigations", { params }),
  create: (payload) => client.post("/investigations", payload),
  update: (id, payload) => client.patch(`/investigations/${encodeURIComponent(id)}`, payload),
  addNote: (id, payload) =>
    client.post(`/investigations/${encodeURIComponent(id)}/notes`, payload),
};

export default investigationsApi;
