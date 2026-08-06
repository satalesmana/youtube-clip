import { createError, defineEventHandler } from "h3";
import { manifestService } from "../../src/container/index.js";
import { toHttpError } from "../../src/utils/http-error.js";

export default defineEventHandler(async () => {
  try {
    const manifests = await manifestService.discover();
    return {
      success: true,
      templates: manifests.map((manifest) => ({
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        aspectRatio: manifest.aspectRatio,
      })),
    };
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
