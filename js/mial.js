/**
 * MarkdownIsALISP interpreter: BuildLife's copy (D-14).
 *
 * Copied from yuwakisaweb/markdown_is_a_lisp/interpreter.js. Changes from the original:
 *   - `let` special form (sequential bindings)
 *   - `and` / `or` take any number of arguments
 *   - `eq` / `!=` no longer throw when comparing with null
 *   - an evaluation step budget per entry-point call (EVAL_STEP_LIMIT)
 *   - host built-ins for records, lists, numbers and text (setupHostLibrary)
 *   - a world loader and entry-point caller in place of the `# main` runner
 *   - compactSource: canonical compact form of a whole source
 *
 * Exposes BL.mial. Plain script, no modules (G-3).
 */
var BL = window.BL = window.BL || {};

(() => {

const EVAL_STEP_LIMIT = 200000;

class BudgetExceeded extends Error {}
const budget = { steps: 0, limit: EVAL_STEP_LIMIT };

/**
 * ------------------------------------------------------------------
 * PARSER
 * ------------------------------------------------------------------
 */

const node = (value, children) => ({ value, children: children || [] });

// Indentation: 1 level = 2 spaces; tabs expand to 2 spaces. Returns both the
// rounded level and the raw space count so the caller can flag indentation
// that isn't a clean multiple of 2 (rounding is a defined, reported behavior,
// not a silent guess).
const measureIndent = (line) => {
  const spaces = line.match(/^(\s*)/)[1].replace(/\t/g, '  ').length;
  return { level: Math.floor(spaces / 2), spaces };
};

/**
 * Literal grammar (backtick-wrapped). Bare words are symbols.
 *   `null` `true` `false`   → those values
 *   `"..."` / `'...'`       → string (surrounding quotes stripped)
 *   ``  (empty)             → empty string
 *   `42` `-3.5`             → number, ONLY when it round-trips exactly
 *                            (String(Number(v)) === v). This is deliberate:
 *                            `1.0`, `1e3`, `+5`, `0x10` stay strings so that
 *                            parse → render → parse is stable.
 *   anything else           → string
 * A backtick cannot appear inside a literal — there is no escape syntax.
 */
const parseToken = (token) => {
  const literalMatch = token.match(/^`([^`]*)`$/);
  if (!literalMatch) return node(token);
  const val = literalMatch[1];
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return node({ string: val.slice(1, -1) });
  }
  if (val === 'null') return node(null);
  if (val === 'true') return node(true);
  if (val === 'false') return node(false);
  const num = Number(val);
  if (val !== '' && !isNaN(num) && isFinite(num) && val === String(num)) return node(num);
  return node({ string: val });
};

// Total: every branch advances `i`, so no input can hang. An opening backtick
// with no closing partner is dropped (the stray char is skipped) and flagged
// via `unterminated` so the caller can report it.
const tokenize = (text) => {
  const tokens = [];
  let unterminated = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '`') {
      const end = text.indexOf('`', i + 1);
      if (end === -1) { unterminated = true; i++; continue; }
      tokens.push(text.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    let end = i;
    while (end < text.length && text[end] !== ' ' && text[end] !== '\t' && text[end] !== '`') end++;
    tokens.push(text.slice(i, end));
    i = end;
  }
  return { tokens, unterminated };
};

const parseContent = (text) => {
  const stripped = text.trim().replace(/^[-*]\s+/, '');
  const { tokens, unterminated } = tokenize(stripped);
  const errors = unterminated ? ['unterminated backtick literal'] : [];
  if (tokens.length === 0) return { node: node(''), errors };
  const head = parseToken(tokens[0]);
  if (tokens.length > 1) head.children = tokens.slice(1).map(parseToken);
  return { node: head, errors };
};

const findParentInStack = (stack, indent) => {
  while (stack.length > 0 && (stack[stack.length - 1]._indent ?? -1) >= indent) {
    stack.pop();
  }
  return stack.length > 0 ? stack[stack.length - 1] : null;
};

// Returns { defs, diagnostics }. Nothing malformed is dropped silently —
// every ignored or rounded line produces a diagnostic carrying its line number.
const parseMarkdown = (input) => {
  const lines = input.split('\n');
  const defs = [];
  const diagnostics = [];
  let currentDef = null;
  let stack = [];

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const trimLine = line.trim();
    if (trimLine.length === 0) return;

    if (trimLine.startsWith('#')) {
      const name = trimLine.replace(/^#+\s*/, '').trim();
      currentDef = { _isDef: true, name, children: [] };
      defs.push(currentDef);
      stack = [];
      return;
    }

    if (!/^[-*]\s/.test(trimLine)) {
      diagnostics.push(`line ${lineNo}: not a "# heading" or "- bullet" — ignored: ${trimLine}`);
      return;
    }

    if (!currentDef) {
      diagnostics.push(`line ${lineNo}: bullet before any "# heading" — ignored: ${trimLine}`);
      return;
    }

    const { level, spaces } = measureIndent(line);
    if (spaces % 2 !== 0) {
      diagnostics.push(`line ${lineNo}: indentation of ${spaces} space(s) is not a multiple of 2 — rounded down to level ${level}`);
    }

    const { node: parsed, errors } = parseContent(trimLine);
    errors.forEach(e => diagnostics.push(`line ${lineNo}: ${e}`));

    const n = node(parsed.value, parsed.children ? [...parsed.children] : []);
    n._indent = level;
    const parent = findParentInStack(stack, level);
    (parent ? parent.children : currentDef.children).push(n);
    stack.push(n);
  });

  return { defs, diagnostics };
};

/**
 * ------------------------------------------------------------------
 * AST → MARKDOWN
 * ------------------------------------------------------------------
 */

const formatValue = (val) => {
  if (val === null) return '`null`';
  if (typeof val === 'number') return `\`${val}\``;
  if (typeof val === 'boolean') return `\`${val}\``;
  if (typeof val === 'object' && val !== null && 'error' in val) return `\`ERROR: ${val.error}\``;
  if (typeof val === 'object' && val !== null && 'string' in val) return `\`"${val.string}"\``;
  return String(val);
};

const nodeToMarkdown = (n, indent, compact) => {
  if (indent === undefined) indent = 0;
  if (compact === undefined) compact = false;

  if (n && n._isLambda) {
    const prefix = '  '.repeat(indent);
    const paramLines = n.params.map(p => '  '.repeat(indent + 1) + '- ' + p).join('\n');
    const bodyLines = n.body.map(b => nodeToMarkdown(b, indent + 1, compact)).join('\n');
    return `${prefix}* lambda\n${paramLines}\n${bodyLines}`;
  }

  if (Array.isArray(n)) {
    return n.map(d => {
      if (d._isDef) {
        const header = `# ${d.name}`;
        const body = d.children.map(c => nodeToMarkdown(c, 0, compact)).join('\n');
        return body ? `${header}\n${body}` : header;
      }
      return nodeToMarkdown(d, 0, compact);
    }).join('\n\n');
  }

  if (!n || typeof n !== 'object') return '  '.repeat(indent) + '- ' + formatValue(n);

  const prefix = '  '.repeat(indent);

  // Data list (null-valued node with children) — render children as sibling bullets
  if (n.value === null && n.children.length > 0) {
    return n.children.map(c => nodeToMarkdown(c, indent, compact)).join('\n');
  }

  const line = `${prefix}- ${formatValue(n.value)}`;
  if (!n.children || n.children.length === 0) return line;

  if (compact) {
    // Collect leading atoms onto the same line, break out at first compound child
    const inlineParts = [];
    let breakIdx = 0;
    for (; breakIdx < n.children.length; breakIdx++) {
      const c = n.children[breakIdx];
      if (c && c.children && c.children.length > 0) break;
      if (c && c._isLambda) break;
      inlineParts.push(formatValue(c.value));
    }
    const remaining = n.children.slice(breakIdx);
    const inlineStr = inlineParts.length > 0 ? ' ' + inlineParts.join(' ') : '';
    if (remaining.length === 0) return `${line}${inlineStr}`;
    const remainingMd = remaining.map(c => nodeToMarkdown(c, indent + 1, compact)).join('\n');
    return `${line}${inlineStr}\n${remainingMd}`;
  }

  const childrenMd = n.children.map(c => nodeToMarkdown(c, indent + 1, compact)).join('\n');
  return `${line}\n${childrenMd}`;
};

/**
 * ------------------------------------------------------------------
 * INTERPRETER
 * ------------------------------------------------------------------
 */

const createEnv = (parent) => ({ parent, vars: {} });

const getVar = (env, name) => {
  if (name in env.vars) return env.vars[name];
  if (env.parent) return getVar(env.parent, name);
  return makeError(name, 'undefined symbol');
};

const setVar = (env, name, val) => { env.vars[name] = val; };

const isSelfEvaluating = (val) =>
  typeof val === 'number' || typeof val === 'boolean' || val === null ||
  (typeof val === 'object' && val !== null && 'string' in val) ||
  (typeof val === 'object' && val !== null && 'error' in val);

const makeError = (symbol, reason) => node(
  { error: `${symbol}: ${reason}` },
  [node(symbol, [node({ string: reason })])]
);
const addTrace = (err, reason) => node(err.value, [...err.children, node({ string: reason })]);
const isError = (n) => n && typeof n === 'object' && n.value && typeof n.value === 'object' && 'error' in n.value;

const isTruthy = (n) => {
  if (!n || typeof n !== 'object') return !!n;
  const v = n.value;
  return v !== false && v !== null && v !== 0;
};

const extractParams = (paramNode) => {
  if (paramNode.children.length > 0) {
    return paramNode.children.map(c => c.value);
  }
  return [paramNode.value];
};

const makeClosure = (paramNames, bodyNodes, env) => ({
  _isLambda: true,
  params: paramNames,
  body: bodyNodes,
  env
});

const evaluateIf = (n, env) => {
  const test = evaluate(n.children[0], env);
  if (isError(test)) return addTrace(test, 'in if condition');
  if (isTruthy(test)) return evaluate(n.children[1], env);
  return n.children[2] ? evaluate(n.children[2], env) : node(null);
};

const evaluateBody = (bodyNodes, env) => {
  let result = node(null);
  for (const n of bodyNodes) {
    result = evaluate(n, env);
    if (isError(result)) return addTrace(result, 'in body');
  }
  return result;
};

// let: first child's children are bindings (`name` with one child expression),
// evaluated in order so later bindings see earlier ones; remaining children are the body.
const evaluateLet = (n, env) => {
  if (n.children.length < 2) return makeError('let', 'needs bindings and a body');
  const localEnv = createEnv(env);
  for (const binding of n.children[0].children) {
    if (typeof binding.value !== 'string' || binding.children.length !== 1) {
      return makeError('let', `binding ${formatValue(binding.value)} needs exactly one expression`);
    }
    const val = evaluate(binding.children[0], localEnv);
    if (isError(val)) return addTrace(val, `in let binding ${binding.value}`);
    setVar(localEnv, binding.value, val);
  }
  return evaluateBody(n.children.slice(1), localEnv);
};

const evaluateLambda = (n, env) => {
  const paramNames = extractParams(n.children[0]);
  return makeClosure(paramNames, n.children.slice(1), env);
};

const evaluate = (n, env) => {
  if (!n || typeof n !== 'object' || !('value' in n)) return n;
  if (++budget.steps > budget.limit) throw new BudgetExceeded();

  // Atom (no children)
  if (n.children.length === 0) {
    if (isSelfEvaluating(n.value)) return n;
    if (typeof n.value === 'string') return getVar(env, n.value);
    return n;
  }

  // Node with children — value is operator
  const opName = n.value;

  // Special forms
  if (opName === 'mial') {
    if (n.children.length !== 1) {
      return makeError('mial', `takes exactly one child, got ${n.children.length}`);
    }
    return n.children[0];
  }
  if (opName === 'eval') {
    const inner = evaluate(n.children[0], env);
    if (isError(inner)) return addTrace(inner, 'in eval');
    return evaluate(inner, env);
  }
  if (opName === 'if') return evaluateIf(n, env);
  if (opName === 'let') return evaluateLet(n, env);
  if (opName === 'lambda') return evaluateLambda(n, env);

  // Function call
  const proc = getVar(env, opName);
  if (isError(proc)) return proc;
  const args = n.children.map(child => evaluate(child, env));
  const firstErr = args.find(isError);
  if (firstErr) return addTrace(firstErr, `in argument to ${opName}`);

  return applyProc(proc, args, opName);
};

// Shared by function calls and the higher-order host built-ins (map, filter, reduce).
const applyProc = (proc, args, opName) => {
  if (proc && proc._isLambda) {
    const localEnv = createEnv(proc.env);
    proc.params.forEach((p, i) => setVar(localEnv, p, args[i]));
    const result = evaluateBody(proc.body, localEnv);
    if (isError(result)) return addTrace(result, `in call to ${opName}`);
    return result;
  }

  if (typeof proc === 'function') {
    const result = proc(...args);
    if (isError(result)) return addTrace(result, `in ${opName}`);
    return result;
  }

  return makeError(opName, 'not a function');
};

/**
 * ------------------------------------------------------------------
 * STANDARD LIBRARY
 * ------------------------------------------------------------------
 */

const setupStandardLibrary = (env, logFn) => {
  // Arithmetic — variadic, folding left. + and * have identities (0 and 1),
  // so they accept zero or one argument; - and / need at least one
  // (single-arg - negates, single-arg / reciprocates, Lisp-style).
  const addPair = (av, bv) => {
    const aStr = typeof av === 'object' && av !== null && 'string' in av;
    const bStr = typeof bv === 'object' && bv !== null && 'string' in bv;
    if (aStr || bStr) {
      return { string: String(aStr ? av.string : av) + String(bStr ? bv.string : bv) };
    }
    return av + bv;
  };
  setVar(env, '+', (...args) => {
    if (args.length === 0) return node(0);
    return node(args.map(a => a.value).reduce(addPair));
  });
  setVar(env, '-', (...args) => {
    if (args.length === 0) return makeError('-', 'needs at least one argument');
    if (args.length === 1) return node(-args[0].value);
    return node(args.map(a => a.value).reduce((a, b) => a - b));
  });
  setVar(env, '*', (...args) => {
    if (args.length === 0) return node(1);
    return node(args.map(a => a.value).reduce((a, b) => a * b));
  });
  setVar(env, '/', (...args) => {
    if (args.length === 0) return makeError('/', 'needs at least one argument');
    if (args.length === 1) return node(1 / args[0].value);
    return node(args.map(a => a.value).reduce((a, b) => a / b));
  });
  setVar(env, '%', (a, b) => node(a.value % b.value));

  // Comparison
  setVar(env, '<=', (a, b) => node(a.value <= b.value));
  setVar(env, '>=', (a, b) => node(a.value >= b.value));
  setVar(env, '<', (a, b) => node(a.value < b.value));
  setVar(env, '>', (a, b) => node(a.value > b.value));
  // BuildLife fix: the original checked `'string' in av`, which throws when a value is null.
  const sameValue = (av, bv) => {
    const isStr = (v) => typeof v === 'object' && v !== null && 'string' in v;
    return isStr(av) && isStr(bv) ? av.string === bv.string : av === bv;
  };
  setVar(env, '!=', (a, b) => node(!sameValue(a.value, b.value)));
  setVar(env, 'eq', (a, b) => node(sameValue(a.value, b.value)));

  // Logic
  setVar(env, 'and', (...args) => node(args.every(isTruthy)));
  setVar(env, 'or', (...args) => node(args.some(isTruthy)));
  setVar(env, 'not', (a) => node(!isTruthy(a)));
  setVar(env, 'null?', (a) => node(a.value === null && a.children.length === 0));
  setVar(env, 'atom?', (a) => node(a.children.length === 0));
  setVar(env, 'list?', (a) => node(a.value === null && a.children.length > 0));
  setVar(env, 'error?', (a) => node(isError(a)));

  // Tree primitives — code introspection and construction
  setVar(env, 'tag', (n) => node(n.value));

  setVar(env, 'children', (n) => {
    if (!n.children || n.children.length === 0) return node(null);
    return node(null, [...n.children]);
  });

  setVar(env, 'make-mial', (tagNode, childrenList) => {
    // A string-literal tag denotes a symbol: `"*"` builds a node tagged *.
    // Literal atoms never need make-mial (an evaluated value already is one),
    // so the string representation is free to mean "symbol name" here.
    const tag = (typeof tagNode.value === 'object' && tagNode.value !== null && 'string' in tagNode.value)
      ? tagNode.value.string
      : tagNode.value;
    if (!childrenList || (childrenList.value === null && childrenList.children.length === 0)) {
      return node(tag);
    }
    return node(tag, [...childrenList.children]);
  });

  setVar(env, 'mial-of', (f) => {
    // The named counterpart of mial: hand back a definition's code as MIAL
    // instead of running it. A bare name in argument position looks up the
    // binding without applying it, so this reads the source of a function.
    if (typeof f === 'function') return makeError('mial-of', 'builtins have no MIAL source');
    if (f && f._isLambda) {
      if (f.params.length === 0) {
        return f.body.length === 1 ? f.body[0] : node(null, [...f.body]);
      }
      const paramSpec = f.params.length === 1
        ? node(f.params[0])
        : node('*', f.params.map(p => node(p)));
      return node('lambda', [paramSpec, ...f.body]);
    }
    // Already MIAL data (a code constant, a literal, a list) — identity.
    return f;
  });

  // List primitives — flat data lists (null-valued nodes)
  setVar(env, 'car', (n) => {
    if (!n.children || n.children.length === 0) return makeError('car', 'empty list');
    return n.children[0];
  });

  setVar(env, 'cdr', (n) => {
    if (n.value === null) {
      // Data list: always return a data list
      if (!n.children || n.children.length <= 1) return node(null);
      return node(null, n.children.slice(1));
    }
    // Cons pair: return second child directly
    if (!n.children || n.children.length < 2) return makeError('cdr', 'insufficient elements');
    if (n.children.length === 2) return n.children[1];
    return node(null, n.children.slice(1));
  });

  // Variadic, folding right: the last argument is the tail, every argument
  // before it is prepended — (cons a b tail) === (cons a (cons b tail)).
  setVar(env, 'cons', (...args) => {
    if (args.length === 0) return makeError('cons', 'needs at least one argument');
    return args.reduceRight((tail, a) => {
      if (tail && tail.value === null && tail.children && tail.children.length > 0) {
        return node(null, [a, ...tail.children]);
      }
      return node(null, [a, tail]);
    });
  });

  setVar(env, 'list', (...args) => {
    return node(null, args);
  });

  // I/O
  setVar(env, 'print', (...args) => {
    const out = args.map(a => {
      const v = a.value;
      if (typeof v === 'object' && v !== null && 'error' in v) return `ERROR: ${v.error}`;
      if (typeof v === 'object' && v !== null && 'string' in v) return v.string;
      return String(v);
    }).join(' ');
    logFn(out);
    return node({ string: out });
  });

  setVar(env, 'print-mial', (n) => {
    const md = nodeToMarkdown(n, 0);
    logFn(md);
    return n;
  });

  // Parse exposed at runtime — print-mial's inverse (Markdown string → MIAL)
  setVar(env, 'parse-mial', (code) => {
    const src = typeof code.value === 'object' && 'string' in code.value
      ? code.value.string : String(code.value);
    const { defs } = parseMarkdown(src);
    return node('program', defs.map(d => node(d.name, d.children)));
  });
};


/**
 * ------------------------------------------------------------------
 * HOST LIBRARY: records, lists, numbers, text (ONTOLOGY host built-ins)
 * ------------------------------------------------------------------
 */

const isStringValue = (v) => typeof v === 'object' && v !== null && 'string' in v;
// A key or name given as a string literal or a bare symbol.
const nameOf = (n) => (isStringValue(n.value) ? n.value.string : n.value);
const isRecord = (n) => !!n && n.value === 'record';
const isList = (n) => !!n && n.value === null;
const listItems = (n) => (isList(n) ? n.children : []);

const field = (r, key) => (isRecord(r) ? r.children.find(f => f.value === key) : undefined);

const strOf = (n) => {
  if (!n || typeof n !== 'object') return String(n);
  if (n._isLambda) return '<lambda>';
  const v = n.value;
  if (n.children.length === 0) {
    if (isStringValue(v)) return v.string;
    if (typeof v === 'object' && v !== null && 'error' in v) return `ERROR: ${v.error}`;
    return String(v);
  }
  return nodeToMarkdown(n, 0, true);
};

const setupHostLibrary = (env) => {
  setVar(env, 'record', (...args) => {
    if (args.length % 2 !== 0) return makeError('record', 'needs key/value pairs');
    const fields = [];
    for (let i = 0; i < args.length; i += 2) fields.push(node(nameOf(args[i]), [args[i + 1]]));
    return node('record', fields);
  });
  setVar(env, 'get', (r, k) => {
    const f = field(r, nameOf(k));
    return f && f.children[0] ? f.children[0] : node(null);
  });
  setVar(env, 'put', (r, k, v) => {
    if (!isRecord(r) && !(isList(r) && r.children.length === 0)) return makeError('put', 'first argument is not a record');
    const key = nameOf(k);
    const fields = isRecord(r) ? r.children.filter(f => f.value !== key) : [];
    const at = isRecord(r) ? r.children.findIndex(f => f.value === key) : -1;
    const updated = node(key, [v]);
    if (at === -1) fields.push(updated);
    else fields.splice(at, 0, updated);
    return node('record', fields);
  });
  setVar(env, 'has?', (r, k) => node(!!field(r, nameOf(k))));
  setVar(env, 'keys', (r) => node(null, isRecord(r) ? r.children.map(f => node({ string: f.value })) : []));

  setVar(env, 'length', (l) => node(isStringValue(l.value) ? l.value.string.length : listItems(l).length));
  setVar(env, 'nth', (l, i) => listItems(l)[i.value] || node(null));
  setVar(env, 'append', (...lists) => node(null, lists.flatMap(listItems)));
  setVar(env, 'map', (f, l) => {
    const out = [];
    for (const x of listItems(l)) {
      const r = applyProc(f, [x], 'map');
      if (isError(r)) return r;
      out.push(r);
    }
    return node(null, out);
  });
  setVar(env, 'filter', (f, l) => {
    const out = [];
    for (const x of listItems(l)) {
      const r = applyProc(f, [x], 'filter');
      if (isError(r)) return r;
      if (isTruthy(r)) out.push(x);
    }
    return node(null, out);
  });
  setVar(env, 'reduce', (f, init, l) => {
    let acc = init;
    for (const x of listItems(l)) {
      acc = applyProc(f, [acc, x], 'reduce');
      if (isError(acc)) return acc;
    }
    return acc;
  });

  setVar(env, 'min', (...args) => node(Math.min(...args.map(a => a.value))));
  setVar(env, 'max', (...args) => node(Math.max(...args.map(a => a.value))));
  setVar(env, 'abs', (a) => node(Math.abs(a.value)));
  setVar(env, 'floor', (a) => node(Math.floor(a.value)));
  setVar(env, 'round', (a) => node(Math.round(a.value)));
  setVar(env, 'clamp', (x, lo, hi) => node(Math.min(hi.value, Math.max(lo.value, x.value))));

  setVar(env, 'str', (x) => node({ string: strOf(x) }));
  // A list argument contributes one line per item, so prompts can include mapped lists.
  setVar(env, 'text', (...args) => node({ string: args.flatMap(a => (isList(a) ? a.children : [a])).map(strOf).join('\n') }));
  setVar(env, 'join', (l, sep) => node({ string: listItems(l).map(strOf).join(sep ? strOf(sep) : '') }));
};

/**
 * ------------------------------------------------------------------
 * WORLD LOADER: definitions → environment, entry-point calls
 * ------------------------------------------------------------------
 */

const isParamSpec = (n) => {
  if (typeof n.value !== 'string') return false;
  if (isSelfEvaluating(n.value)) return false;
  if (n.children.length === 0) return true;
  return n.children.every(c => typeof c.value === 'string' && !isSelfEvaluating(c.value) && c.children.length === 0);
};

const registerDefinition = (def, globalEnv) => {
  if (def.children.length === 0) return;

  if (def.children.length === 1 && isSelfEvaluating(def.children[0].value) && def.children[0].children.length === 0) {
    setVar(globalEnv, def.name, def.children[0]);
    return;
  }

  // Code constant: a single mial child binds the quoted subtree as data.
  if (def.children.length === 1 && def.children[0].value === 'mial') {
    setVar(globalEnv, def.name, evaluate(def.children[0], globalEnv));
    return;
  }

  const firstChild = def.children[0];
  if (def.children.length >= 2 && isParamSpec(firstChild)) {
    setVar(globalEnv, def.name, makeClosure(extractParams(firstChild), def.children.slice(1), globalEnv));
    return;
  }

  setVar(globalEnv, def.name, makeClosure([], def.children, globalEnv));
};

// Canonical compact form of a source: each bullet's leading atoms on its own line (D-33).
// Lines the parser ignores (prose, text before the first heading) are dropped.
const compactSource = (text) => nodeToMarkdown(parseMarkdown(text).defs, 0, true) + '\n';

const loadSource = (text) => {
  const { defs, diagnostics } = parseMarkdown(text);
  const env = createEnv(null);
  setupStandardLibrary(env, (msg) => console.log('[mial]', msg));
  setupHostLibrary(env);
  defs.forEach(def => registerDefinition(def, env));
  return { env, names: defs.map(d => d.name), diagnostics };
};

const errorText = (n) => {
  const trace = n.children.slice(1).map(strOf);
  return trace.length ? `${n.value.error} (${trace.join(' ← ')})` : n.value.error;
};

// Calls a named definition with argument nodes. Never throws: every failure is
// { ok: false, error } so the caller can hand it to the repair rule (D-8).
const callDef = (loaded, name, args = []) => {
  const proc = loaded.env.vars[name];
  if (proc === undefined) return { ok: false, error: `missing definition "# ${name}"` };
  budget.steps = 0;
  try {
    let result;
    if (proc && proc._isLambda) {
      if (proc.params.length !== args.length) {
        return { ok: false, error: `"# ${name}" takes ${proc.params.length} argument(s), called with ${args.length}` };
      }
      result = applyProc(proc, args, name);
    } else if (args.length === 0) {
      result = proc;
    } else {
      return { ok: false, error: `"# ${name}" is not a function` };
    }
    if (isError(result)) return { ok: false, error: errorText(result) };
    return { ok: true, value: result };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: `"# ${name}" exceeded the step budget of ${budget.limit} evaluations` };
    if (e instanceof RangeError) return { ok: false, error: `"# ${name}" recursed too deeply (stack overflow)` };
    return { ok: false, error: `"# ${name}" crashed: ${e.message}` };
  }
};

// JSON ↔ MIAL. Objects become Records, arrays become data lists.
const fromJS = (v) => {
  if (v === null || v === undefined) return node(null);
  if (typeof v === 'string') return node({ string: v });
  if (typeof v === 'number' || typeof v === 'boolean') return node(v);
  if (Array.isArray(v)) return node(null, v.map(fromJS));
  return node('record', Object.entries(v).map(([k, x]) => node(k, [fromJS(x)])));
};

const toJS = (n) => {
  if (!n || typeof n !== 'object') return n;
  if (n._isLambda) return '<lambda>';
  const v = n.value;
  if (isRecord(n)) return Object.fromEntries(n.children.map(f => [f.value, toJS(f.children[0])]));
  if (v === null) return n.children.length ? n.children.map(toJS) : null;
  if (isStringValue(v)) return v.string;
  if (typeof v === 'object' && 'error' in v) return { error: v.error };
  return v;
};

// Closures can't be saved (their environments are cyclic); they serialize as a marker string.
const serialize = (n) => JSON.stringify(n, (k, v) => (v && v._isLambda ? node({ string: '<lambda>' }) : v));

BL.mial = {
  node, parseMarkdown, nodeToMarkdown, isError, isTruthy, isRecord, isList, isStringValue,
  loadSource, compactSource, callDef, fromJS, toJS, serialize, strOf, field,
  budget, EVAL_STEP_LIMIT,
};

})();
