import api from "./baseAPI";

const testService = {
  getTestCatalog: () => api.get("test/catalog"),
  getCategories: () => api.get("/test/categories"),
  getTestList: () => api.get("/test/all"),
  addTest: (data) => api.post("/test", data),
  addManualTest: ({ name, price, commission }) => api.post("/test/manual", { name, price, commission }),
  updatePrice: (testId, price) => api.patch(`/test/${testId}/price`, { price }),
  updateCommission: (testId, commission) => api.patch(`/test/${testId}/commission`, { commission }),
  updateSchema: (testId, schemaId) => api.patch(`/test/${testId}/schema`, { schemaId }),
  deleteTest: (_id) => api.delete(`/test/${_id}`),
  getSchemasByTestId: (testId) => api.get("/test/schema/" + testId),
  getSchemaBySchemaId: (schemaId) => api.get("/schema/" + schemaId),
  checkManualDuplicate: (name) => api.get("/test/manual/check-duplicate", { params: { name } }),
};

export default testService;
