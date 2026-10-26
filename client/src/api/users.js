import client from "./client";

export const usersApi = {
  list: () => client.get("/admin/users"),
  listAnalysts: () => client.get("/users/analysts"),
  createAnalyst: (payload) => client.post("/users", payload),
};

export default usersApi;
