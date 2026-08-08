import type { Equals, Expect } from "./_assert.js";
import type { Transport, TransportCapabilities } from "../src/index.js";
import {
  COMMAND_PALETTE_CAPABILITIES,
  CONVERSATIONAL_CAPABILITIES,
  createStubTransport,
  type StubTransportOptions,
} from "../test/fixtures/stub-transport.js";

const options: StubTransportOptions = {
  capabilities: CONVERSATIONAL_CAPABILITIES,
  initialStatus: "idle",
};
const stub = createStubTransport(options);
const _transport: Transport = stub.transport;
const _conversationalProfile: TransportCapabilities = CONVERSATIONAL_CAPABILITIES;
const _commandPaletteProfile: TransportCapabilities = COMMAND_PALETTE_CAPABILITIES;

type _stubTransportKeys = Expect<Equals<keyof typeof stub.transport, keyof Transport>>;

void _transport;
void _conversationalProfile;
void _commandPaletteProfile;
