export const MAX_URLS_PER_BATCH = 10_000;

export const createBatchSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["urls"],
    properties: {
      urls: {
        type: "array",
        minItems: 1,
        maxItems: MAX_URLS_PER_BATCH,
        items: {
          type: "string",
          minLength: 1,
          maxLength: 2048,
        },
      },
    },
  },
  headers: {
    type: "object",
    properties: {
      "idempotency-key": { type: "string", minLength: 1, maxLength: 200 },
    },
  },
} as const;

export const batchParamsSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
} as const;

export const batchActionSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
} as const;
