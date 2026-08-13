import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

process.stdout.write(
  `CONCIERGE_ES256_PRIVATE_KEY_PEM=${JSON.stringify(privateKey)}\n` +
    `CONCIERGE_ES256_PUBLIC_KEY_PEM=${JSON.stringify(publicKey)}\n`,
);
