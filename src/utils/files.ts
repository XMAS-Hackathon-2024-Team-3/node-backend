import crypto from "crypto";

export function hashFileName() {
	return crypto.createHash("md5").update(Date.now().toString()).digest("hex");
}
