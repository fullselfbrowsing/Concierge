import { CONSENT_GRADE_ORDER } from "./types.js";
import type {
  Concierge,
  ConsentGrade,
  ConsentProfile,
  TurnIdentityProvenance,
} from "./types.js";

const INVALID_CONSENT_PROFILE =
  "Invalid Concierge configuration: consentProfile must contain data-only consentGrade and userTurnIdentity fields with supported values.";

const TURN_IDENTITY_ORDER: readonly TurnIdentityProvenance[] =
  /* @__PURE__ */ Object.freeze([
    "none",
    "agent-forgeable",
    "human-attested",
  ]);

const CONSENT_PROFILE_MARKER: unique symbol = Symbol(
  "@fullselfbrowsing/concierge.consent-profile",
);

export const WEAKEST_CONSENT_PROFILE: ConsentProfile =
  /* @__PURE__ */ Object.freeze({
    consentGrade: "none",
    userTurnIdentity: "none",
  });

function invalidConsentProfile(): never {
  throw new TypeError(INVALID_CONSENT_PROFILE);
}

function isConsentGrade(value: unknown): value is ConsentGrade {
  return typeof value === "string" &&
    (CONSENT_GRADE_ORDER as readonly string[]).includes(value);
}

function isTurnIdentityProvenance(
  value: unknown,
): value is TurnIdentityProvenance {
  return value === "none" ||
    value === "agent-forgeable" ||
    value === "human-attested";
}

function dataValue(
  value: object,
  key: "consentGrade" | "userTurnIdentity",
): unknown {
  const descriptor: PropertyDescriptor | undefined =
    Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    return invalidConsentProfile();
  }
  return descriptor.value;
}

/** Detach and validate the declared application ceiling without invoking accessors. */
export function snapshotConsentProfile(value: unknown): ConsentProfile {
  if (value === undefined) {
    return WEAKEST_CONSENT_PROFILE;
  }
  if (typeof value !== "object" || value === null) {
    return invalidConsentProfile();
  }

  try {
    const prototype: object | null = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return invalidConsentProfile();
    }

    const consentGrade: unknown = dataValue(value, "consentGrade");
    const userTurnIdentity: unknown = dataValue(value, "userTurnIdentity");
    if (
      !isConsentGrade(consentGrade) ||
      !isTurnIdentityProvenance(userTurnIdentity)
    ) {
      return invalidConsentProfile();
    }

    return Object.freeze({ consentGrade, userTurnIdentity });
  } catch {
    return invalidConsentProfile();
  }
}

export function consentGradeRank(value: ConsentGrade): number {
  return CONSENT_GRADE_ORDER.indexOf(value);
}

export function turnIdentityRank(value: TurnIdentityProvenance): number {
  return TURN_IDENTITY_ORDER.indexOf(value);
}

/** Whether an observed capability is at least as strong as the declared one. */
export function profileDominates(
  actual: ConsentProfile,
  declared: ConsentProfile,
): boolean {
  return consentGradeRank(actual.consentGrade) >=
      consentGradeRank(declared.consentGrade) &&
    turnIdentityRank(actual.userTurnIdentity) >=
      turnIdentityRank(declared.userTurnIdentity);
}

/** Attach the captured ceiling without widening the public Concierge handle. */
export function attachConsentProfile(
  concierge: Concierge,
  profile: ConsentProfile,
): Concierge {
  Object.defineProperty(concierge, CONSENT_PROFILE_MARKER, {
    value: profile,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return concierge;
}

/** Read only the marker authored by this core instance; structural handles are weakest. */
export function consentProfileOf(concierge: Concierge): ConsentProfile {
  try {
    const descriptor: PropertyDescriptor | undefined =
      Object.getOwnPropertyDescriptor(concierge, CONSENT_PROFILE_MARKER);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable ||
      descriptor.writable ||
      descriptor.configurable
    ) {
      return WEAKEST_CONSENT_PROFILE;
    }

    const profile: unknown = descriptor.value;
    if (typeof profile !== "object" || profile === null || !Object.isFrozen(profile)) {
      return WEAKEST_CONSENT_PROFILE;
    }
    const consentGrade: unknown = dataValue(profile, "consentGrade");
    const userTurnIdentity: unknown = dataValue(profile, "userTurnIdentity");
    return isConsentGrade(consentGrade) &&
      isTurnIdentityProvenance(userTurnIdentity)
      ? (profile as ConsentProfile)
      : WEAKEST_CONSENT_PROFILE;
  } catch {
    return WEAKEST_CONSENT_PROFILE;
  }
}
