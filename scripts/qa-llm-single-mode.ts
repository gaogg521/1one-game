import assert from "node:assert/strict";
import type OpenAI from "openai";
import { llmJsonOpenAICompatible } from "../src/lib/llm/provider-openai-compatible";

async function main() {
  for (const status of [undefined, 401, 429, 500]) {
    let calls=0;
    const client={chat:{completions:{create:async()=>{calls++;throw Object.assign(new Error('llm openai json_schema timeout after 240000ms'),{status});}}}} as unknown as OpenAI;
    const result=await llmJsonOpenAICompatible({client,req:{provider:'openai',model:'test',mode:'json_schema',system:'JSON',user:'test',temperature:0,timeoutMs:1000}});
    assert.equal(result.ok,false);assert.equal(calls,1,'Timeout/auth/rate/server errors must never trigger format fallback');
  }
  for (const status of [400,422]) {
    let calls=0;
    const client={chat:{completions:{create:async()=>{if(++calls===1)throw Object.assign(new Error('response_format json_schema unsupported'),{status});return {choices:[{finish_reason:'stop',message:{content:'{}'}}]};}}}} as unknown as OpenAI;
    const result=await llmJsonOpenAICompatible({client,req:{provider:'openai',model:'test',mode:'json_schema',system:'JSON',user:'test',temperature:0,timeoutMs:1000}});
    assert.equal(result.ok,true);assert.equal(calls,2,'Explicit unsupported schema can fall back');
  }
  {
    let calls=0;
    const client={chat:{completions:{create:async(_body:unknown,options:{signal:AbortSignal})=>{
      calls++;
      if(calls===1){await new Promise(resolve=>setTimeout(resolve,1500));return {choices:[{finish_reason:'stop',message:{content:'not JSON'}}]};}
      return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
    }}}} as unknown as OpenAI;
    const started=Date.now();
    const result=await llmJsonOpenAICompatible({client,req:{provider:'openai',model:'test',mode:'json_schema',system:'JSON',user:'test',temperature:0,timeoutMs:4000}});
    assert.equal(result.ok,false);assert.equal(calls,2);
    assert.ok(Date.now()-started<5000,'Fallback must share the original deadline instead of taking another full timeout');
  }
  for (const message of ["llm openai json_schema timeout after 90000ms", "400 response_format json_schema is unsupported"]) {
    let calls = 0;
    const client = { chat: { completions: { create: async () => { calls++; throw new Error(message); } } } } as unknown as OpenAI;
    const result = await llmJsonOpenAICompatible({ client, req: {
      provider: "openai", model: "test", mode: "json_schema", singleModeOnly: true,
      system: "JSON", user: "test", temperature: 0, timeoutMs: 1000,
    } });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, message);
    assert.equal(calls, 1, "single mode must not issue a fallback request");
  }
  for (const thinking of [undefined, { type: "disabled" as const }]) {
    let body: Record<string, unknown> = {};
    const client = { chat: { completions: { create: async (request: Record<string, unknown>) => {
      body = request;
      return { choices: [{ finish_reason: "stop", message: { content: "{}" } }] };
    } } } } as unknown as OpenAI;
    const result = await llmJsonOpenAICompatible({ client, req: {
      provider: "openai", model: "test", mode: "json_schema", singleModeOnly: true,
      system: "JSON", user: "test", temperature: 0, timeoutMs: 1000, thinking,
    } });
    assert.equal(result.ok, true);
    assert.deepEqual(body.thinking, thinking);
    assert.equal("thinking" in body, thinking !== undefined);
  }
  console.log("PASS: single-mode errors retain their actual cause without fallback");
}
void main();
