import { managementRoutes } from "../_lib/managementTables";
import { buildUdemyCourseWritePayload } from "../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("udemy", buildUdemyCourseWritePayload);
export const GET = handlers.GET;
export const POST = handlers.POST;
