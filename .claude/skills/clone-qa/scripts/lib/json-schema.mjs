function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left)) {
    return Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => deepEqual(value, right[index]));
  }
  if (typeof left === "object") {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return deepEqual(leftKeys, rightKeys)
      && leftKeys.every((key) => deepEqual(left[key], right[key]));
  }
  return false;
}

function decodePointerPart(part) {
  return part.replaceAll("~1", "/").replaceAll("~0", "~");
}

function resolveReference(rootSchema, reference) {
  if (!reference.startsWith("#/")) {
    throw new Error(`Only local JSON Schema references are supported: ${reference}`);
  }
  return reference
    .slice(2)
    .split("/")
    .map(decodePointerPart)
    .reduce((value, key) => value?.[key], rootSchema);
}

function describe(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function validateFormat(value, format) {
  if (format === "date-time") {
    return typeof value === "string"
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      && Number.isFinite(Date.parse(value));
  }
  if (format === "uri") {
    if (typeof value !== "string") return false;
    try {
      const parsed = new URL(value);
      return Boolean(parsed.protocol);
    } catch {
      return false;
    }
  }
  return true;
}

function runValidation(value, schema, rootSchema, path, errors) {
  if (schema === true) return;
  if (schema === false) {
    errors.push({ path, message: "value is forbidden by schema" });
    return;
  }
  if (!schema || typeof schema !== "object") {
    errors.push({ path, message: "invalid schema node" });
    return;
  }

  if (schema.$ref) {
    const resolved = resolveReference(rootSchema, schema.$ref);
    if (!resolved) {
      errors.push({ path, message: `unresolved schema reference ${schema.$ref}` });
      return;
    }
    runValidation(value, resolved, rootSchema, path, errors);
    return;
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push({ path, message: `must equal ${JSON.stringify(schema.const)}` });
  }
  if (schema.enum && !schema.enum.some((entry) => deepEqual(value, entry))) {
    errors.push({ path, message: `must be one of ${schema.enum.map(JSON.stringify).join(", ")}` });
  }

  for (const keyword of ["allOf", "anyOf", "oneOf"]) {
    if (!schema[keyword]) continue;
    const branchResults = schema[keyword].map((branch) => {
      const branchErrors = [];
      runValidation(value, branch, rootSchema, path, branchErrors);
      return branchErrors;
    });
    const passing = branchResults.filter((branchErrors) => branchErrors.length === 0).length;
    if (keyword === "allOf") {
      branchResults.flat().forEach((error) => errors.push(error));
    } else if (keyword === "anyOf" && passing === 0) {
      errors.push({ path, message: "must satisfy at least one schema branch" });
    } else if (keyword === "oneOf" && passing !== 1) {
      errors.push({ path, message: "must satisfy exactly one schema branch" });
    }
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((type) => typeMatches(value, type))) {
      errors.push({
        path,
        message: `must be ${allowed.join(" or ")}; received ${describe(value)}`,
      });
      return;
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, message: `must contain at least ${schema.minLength} character(s)` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, message: `must contain at most ${schema.maxLength} character(s)` });
    }
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) {
      errors.push({ path, message: `must match pattern ${schema.pattern}` });
    }
    if (schema.format && !validateFormat(value, schema.format)) {
      errors.push({ path, message: `must be a valid ${schema.format}` });
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `must be >= ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `must be <= ${schema.maximum}` });
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push({ path, message: `must be > ${schema.exclusiveMinimum}` });
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      errors.push({ path, message: `must be < ${schema.exclusiveMaximum}` });
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path, message: `must contain at least ${schema.minItems} item(s)` });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path, message: `must contain at most ${schema.maxItems} item(s)` });
    }
    if (schema.uniqueItems) {
      for (let index = 0; index < value.length; index += 1) {
        if (value.slice(0, index).some((entry) => deepEqual(entry, value[index]))) {
          errors.push({ path: `${path}/${index}`, message: "must be unique in this array" });
        }
      }
    }
    if (schema.items) {
      value.forEach((item, index) => {
        runValidation(item, schema.items, rootSchema, `${path}/${index}`, errors);
      });
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) {
        errors.push({ path, message: `missing required property ${JSON.stringify(required)}` });
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) {
        runValidation(child, properties[key], rootSchema, `${path}/${key}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push({ path: `${path}/${key}`, message: "additional property is not allowed" });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        runValidation(child, schema.additionalProperties, rootSchema, `${path}/${key}`, errors);
      }
    }
  }
}

export function validateAgainstSchema(value, schema) {
  const errors = [];
  runValidation(value, schema, schema, "$", errors);
  return { valid: errors.length === 0, errors };
}
