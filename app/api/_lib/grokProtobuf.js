/**
 * xAI grok.com 的 `grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig` 沒有公開 `.proto`，
 * 這裡的欄位對應是社群逆向出來的（steipete/CodexBar、OmniRoute issue #6844 對 grok.com
 * 的即時封包分析），之後 xAI 隨時可能改變欄位順序或內容——寧可解不出來回 null，
 * 也不要讓一次格式變動炸掉整個查詢。
 *
 * 已確認的真實回應形狀（2026-09 實測）：
 *   頂層 field 1（length-delimited）── 內層「credits info」訊息
 *     子欄位 1（wire type 5＝fixed32，float）── 用量百分比 0..100（100.0＝全部用完）
 *     子欄位 5（wire type 2＝length-delimited，Timestamp{seconds,nanos}）── 額度池重設時間
 * 其余子欄位（4/7/8/11/13）目前忽略。
 *
 * 提醒：網上部分逆向文件（例如 OmniRoute issue #6844）把子欄位 1 描述成 0..1 的分数，
 * 但實測拿到的原始 float 就是 100.0 本人（不是 1.0），跟 vct-core 的 GrokCreditsConfig
 * （credit_usage_percent: f64，0..100）完全对得上，所以這邊以实測為準、不再乘 100。
 *
 * gRPC-web 回應可能是兩種形狀：
 * - 「framed」：一個或多個 5-byte header 的 frame（1 byte flag + 4 byte big-endian 長度）。
 *   一般 fetch() 打 unary call 會拿到 DATA frame（flag 0x00／0x01）後面緊接著 TRAILER
 *   frame（flag 最高位是 1，內容是 `grpc-status:0` 這種文字，不是 protobuf）。
 * - 「raw」：整包就是 protobuf message，沒有 frame header。
 */

const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_LENGTH_DELIMITED = 2;
const WIRE_FIXED32 = 5;

function readVarint(buf, offset) {
  let result = 0n;
  let shift = 0n;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos];
    result |= BigInt(byte & 0x7f) << shift;
    pos += 1;
    if ((byte & 0x80) === 0) break;
    shift += 7n;
  }
  return { value: result, next: pos };
}

function readTag(buf, offset) {
  const { value, next } = readVarint(buf, offset);
  const tag = Number(value);
  return { fieldNumber: tag >>> 3, wireType: tag & 0x7, next };
}

/** 跳過一個不認得的欄位的值，回傳下一個 offset。 */
function skipField(buf, offset, wireType) {
  switch (wireType) {
    case WIRE_VARINT:
      return readVarint(buf, offset).next;
    case WIRE_FIXED64:
      return offset + 8;
    case WIRE_LENGTH_DELIMITED: {
      const { value, next } = readVarint(buf, offset);
      return next + Number(value);
    }
    case WIRE_FIXED32:
      return offset + 4;
    default:
      throw new Error(`未知的 protobuf wire type: ${wireType}`);
  }
}

/**
 * 逐欄位走訪一段 protobuf message。`visit` 想自己處理某個欄位就回傳「值讀完後」的 offset
 * （數字），交給預設的 skipField 處理就回傳 undefined。
 */
function forEachField(buf, start, end, visit) {
  let offset = start;
  while (offset < end) {
    const { fieldNumber, wireType, next } = readTag(buf, offset);
    const handled = visit(fieldNumber, wireType, next);
    offset = typeof handled === "number" ? handled : skipField(buf, next, wireType);
  }
}

function readLengthDelimited(buf, offset) {
  const { value, next } = readVarint(buf, offset);
  const length = Number(value);
  return { start: next, end: next + length };
}

function decodeTimestamp(buf, start, end) {
  let seconds = null;
  let nanos = 0;
  forEachField(buf, start, end, (fieldNumber, wireType, offset) => {
    if (wireType !== WIRE_VARINT) return undefined;
    const { value, next } = readVarint(buf, offset);
    if (fieldNumber === 1) seconds = Number(value);
    if (fieldNumber === 2) nanos = Number(value);
    return next;
  });
  if (seconds === null) return null;
  return new Date(seconds * 1000 + Math.round(nanos / 1e6)).toISOString();
}

/**
 * 注意：proto3 对數值欄位會省略預設值（0）——實測確認：一個從未使用過的 Grok 帳號，
 * 回應裡根本沒有子欄位 1（用量比例），不是它存在但值是 0。所以這邊一律以 0 當預設，
 * 不能拿 null——否則一個完全沒用過的帳號會被看成「解不出來」而不是「0% 已用」。
 */
function decodeCreditsInfo(buf, start, end) {
  let usageRatio = 0;
  let resetsAtIso = null;
  forEachField(buf, start, end, (fieldNumber, wireType, offset) => {
    if (fieldNumber === 1 && wireType === WIRE_FIXED32) {
      usageRatio = buf.readFloatLE(offset);
      return offset + 4;
    }
    if (fieldNumber === 5 && wireType === WIRE_LENGTH_DELIMITED) {
      const nested = readLengthDelimited(buf, offset);
      resetsAtIso = decodeTimestamp(buf, nested.start, nested.end);
      return nested.end;
    }
    return undefined;
  });
  return { usageRatio, resetsAtIso };
}

/** gRPC-web 一個 frame 的 5-byte header：1 byte flag + 4 byte big-endian 長度。 */
function probeFrameHeader(buf, offset) {
  if (offset + 5 > buf.length) return null;
  const flag = buf[offset];
  if (flag !== 0x00 && flag !== 0x01 && flag !== 0x80 && flag !== 0x81) return null;
  const length = buf.readUInt32BE(offset + 1);
  if (offset + 5 + length > buf.length) return null;
  return { flag, payloadStart: offset + 5, payloadEnd: offset + 5 + length };
}

/** 找出第一個 DATA frame（flag 最高位是 0）的內容，跳過 TRAILER frame（flag 最高位是 1）。 */
function findDataFramePayload(buf) {
  let offset = 0;
  while (offset < buf.length) {
    const frame = probeFrameHeader(buf, offset);
    if (!frame) return null;
    const isTrailer = (frame.flag & 0x80) !== 0;
    if (!isTrailer) return buf.subarray(frame.payloadStart, frame.payloadEnd);
    offset = frame.payloadEnd;
  }
  return null;
}

/**
 * 解析 `GetGrokCreditsConfig` 的回應（framed 或 raw 都吃）。
 *
 * 注意區分兩種「沒數字」：這個方法隳屬的 `null` 只代表「連最外層的訊息都找不到，
 * 格式可能已變動」；若成功找到最外層但內層的用量比例子欄位不存在，那是 proto3
 * 省略預設值（實測確認：從未使用過的帳號根本不會帶這個子欄位，不是它存在但值是 0），
 * 代表「0% 已用」，不是「解不出來」。
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer
 * @returns {{ usageRatio: number, resetsAtIso: string | null } | null}
 */
export function decodeGrokCreditsResponse(buffer) {
  try {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    if (buf.length === 0) return { usageRatio: 0, resetsAtIso: null };

    const framed = findDataFramePayload(buf);
    const payload = framed || buf;
    if (payload.length === 0) return { usageRatio: 0, resetsAtIso: null };

    let found = false;
    let result = { usageRatio: 0, resetsAtIso: null };
    forEachField(payload, 0, payload.length, (fieldNumber, wireType, offset) => {
      if (fieldNumber === 1 && wireType === WIRE_LENGTH_DELIMITED) {
        found = true;
        const nested = readLengthDelimited(payload, offset);
        result = decodeCreditsInfo(payload, nested.start, nested.end);
        return nested.end;
      }
      return undefined;
    });

    // 真的連最外層的 field 1 都找不到，才算解析失敗（回應的層結構跟預期不一樣）。
    if (!found) return null;

    return result;
  } catch {
    return null;
  }
}
