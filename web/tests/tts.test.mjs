import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { generateWordAudio } from "../dist/server/tts.js";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "c2e-tts-test-"));

function makeConfig(audioDir) {
  return {
    port: 3000,
    databasePath: path.join(tempRoot, "test.sqlite"),
    aiTimeoutMs: 30000,
    reviewScoreThreshold: 80,
    nodeEnv: "test",
    ttsTimeoutMs: 30000,
    wordAudioGeneratedDir: audioDir
  };
}

function volcSettings() {
  return {
    provider: "volcengine",
    baseUrl: "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
    format: "mp3",
    timeoutMs: 30000,
    accessToken: "api-key",
    cluster: "seed-tts-2.0",
    voiceType: "zh_female_cancan_mars_bigtts",
    encoding: "mp3",
    configured: true,
    updatedAt: null
  };
}

test("Volcengine TTS adapter decodes base64 audio and writes an mp3", async () => {
  const audioDir = await mkdtemp(path.join(tempRoot, "generated-"));
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return new Response(
      [
        JSON.stringify({ code: 0, data: Buffer.from("mp3-").toString("base64") }),
        JSON.stringify({ code: 0, data: Buffer.from("bytes").toString("base64") }),
        JSON.stringify({ code: 0, message: "" })
      ].join("\n"),
      {
      status: 200,
      headers: { "Content-Type": "application/json" }
      }
    );
  };

  const result = await generateWordAudio(makeConfig(audioDir), volcSettings(), { id: "w_hello", name: "hello" }, fetchImpl);

  assert.equal(result.relativePath, "generated/w_hello.mp3");
  assert.equal(await readFile(result.absolutePath, "utf8"), "mp3-bytes");
  assert.equal(calls[0].url, "https://openspeech.bytedance.com/api/v3/tts/unidirectional");
  assert.equal(calls[0].headers["X-Api-Key"], "api-key");
  assert.equal(calls[0].headers["X-Api-Resource-Id"], "seed-tts-2.0");
  assert.equal(calls[0].body.req_params.speaker, "zh_female_cancan_mars_bigtts");
  assert.equal(calls[0].body.req_params.audio_params.format, "mp3");
  assert.equal(calls[0].body.req_params.text, "hello");
});

test("Volcengine TTS adapter does not leave a partial file after provider failure", async () => {
  const audioDir = await mkdtemp(path.join(tempRoot, "failed-"));
  const fetchImpl = async () =>
    new Response(JSON.stringify({ code: 4000, message: "bad token" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  await assert.rejects(
    () => generateWordAudio(makeConfig(audioDir), volcSettings(), { id: "w_fail", name: "fail" }, fetchImpl),
    /bad token/
  );
  assert.deepEqual(await readdir(audioDir), []);
});
