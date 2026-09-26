export const createBatchSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["urls"],
    properties: {
      urls: {
        type: "array",
        minItems: 1,
        maxItems: 10000,
        items: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },
} as const;
