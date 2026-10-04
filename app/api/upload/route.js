import { cloudUpload } from "../../../lib/uploads.mjs";
import { viewer } from "../../../lib/session.mjs";
import { AppError } from "../../../lib/errors.mjs";
export const runtime = "nodejs";
export async function POST(request) {
  try {
    return await cloudUpload(request, viewer);
  } catch (e) {
    return Response.json(
      { error: e instanceof AppError ? e.code : "UPLOAD_FAILED" },
      { status: e.status || 500 },
    );
  }
}
