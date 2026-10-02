import { managementRoutes } from "../../_lib/managementTables";
import { buildUdemyCourseWritePayload } from "../../../../lib/managementRecords";

export const dynamic = "force-dynamic";
const handlers = managementRoutes("udemy", buildUdemyCourseWritePayload);
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
