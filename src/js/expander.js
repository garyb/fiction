/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, strict: true*/
/*global define*/
define(["util", "syntax"], function (util, syntax) {

    "use strict";
    
    var checkForm = util.checkForm;
    var createForm = util.createForm;
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printRawForm(form));
    }
    
    // ------------------------------------------------------------------------
    //  Identifier environment
    // ------------------------------------------------------------------------
    
    function put(env, id, fn) {
        var newId = id;
        var result = util.copyProps(env, {});
        if (fn) {
            result[id] = fn;
        } else {
            if (env.hasOwnProperty(newId)) {
                var n = 1;
                while (env.hasOwnProperty(newId + n)) {
                    n++;
                }
                newId += n.toString();
            }
            result[id] = newId;
            result[newId] = newId;
        }
        return { id: newId, env: result };
    }
    
    function get(env, id, form) {
        if (env.hasOwnProperty(id)) {
            return env[id];
        } else {
            return id;
            //error("Undefined identifier '" + id + "'", form);
        }
    }
    
    // ------------------------------------------------------------------------
    //  Expand transforms
    // ------------------------------------------------------------------------
    
    var symbols = {
        "var": createForm("symbol", "var"),
        "fn": createForm("symbol", "fn"),
        "obj": createForm("symbol", "obj"),
        "set!": createForm("symbol", "set!"),
        "if": createForm("symbol", "if"),
        "quote": createForm("symbol", "quote"),
        "quasiquote": createForm("symbol", "quasiquote"),
        "unquote": createForm("symbol", "unquote"),
        "unquote-splicing": createForm("symbol", "unquote-splicing"),
        ".": createForm("symbol", "."),
        "...": createForm("symbol", "...")
    };
    
    function expandImport(atoms, form, env, imp, impChain) {
        syntax.checks["import"](atoms, form);
        var result = [];
        for (var i = 0, l = atoms.length; i < l; i++) {
            var name = atoms[i].value;
            if (!impChain.hasOwnProperty(name)) {
                impChain = util.copyProps(impChain, {});
                impChain[name] = true;
                var tmp = expandAll(imp[name], env, imp, impChain);
                result = result.concat(tmp.value);
                env = tmp.env;
            }
        }
        return { value: result, env: env };
    }
    
    function expandVar(atoms, form, env, imp, impChain) {
        syntax.checks["var"](atoms, form);
        var tmp = put(env, atoms[0].value);
        var id = createForm("symbol", tmp.id);
        tmp = expand(atoms[1], tmp.env, imp, impChain);
        var result = createForm("list", [symbols["var"], id].concat(tmp.value));
        return { value: result, env: tmp.env };
    }
    
    function expandAssign(atoms, form, env, imp, impChain) {
        syntax.checks["set!"](atoms, form);
        var result, tmp, prop;
        if (atoms[0].type === "list") {
            if (atoms[0].value[0].value === ".") {
                tmp = expandAll(atoms[0].value, env, imp, impChain);
                prop = createForm("list", tmp.value);
                env = tmp.env;
            } else {
                tmp = expandShortProp(atoms[0], env, imp, impChain);
                prop = tmp.value;
                env = tmp.env;
            }
        } else {
            var ev = get(env, atoms[0].value);
            if (typeof ev === "function") {
                error("cannot assign to syntax identifier", form);
            }
            prop = createForm("symbol", ev);
        }
        tmp = expand(atoms[1], env, imp, impChain);
        env = tmp.env;
        result = createForm("list", [symbols["set!"], prop].concat(tmp.value));
        return { value: result, env: env };
    }
    
    function expandShortProp(form, env, imp, impChain) {
        var propName = createForm("literal", form.value[0].value.substring(1));
        var prop = createForm("list", [symbols["."], form.value[1], propName]);
        var tmp = expandProp(prop.value.slice(1), prop, env, imp, impChain);
        var result = tmp.value;
        if (form.value.length > 2) {
            result = createForm("list", [result].concat(form.value.slice(2)));
        }
        return { value: result, env: env };
    }
    
    function expandProp(atoms, form, env, imp, impChain) {
        syntax.checks["."](atoms, form);
        var tmp = expand(atoms[0], env, imp, impChain);
        var obj = tmp.value;
        tmp = expand(atoms[1], tmp.env, imp, impChain);
        var prop = tmp.value;
        var result = createForm("list", [symbols["."]].concat(obj).concat(prop));
        return { value: result, env: tmp.env };
    }
    
    function expandIf(atoms, form, env, imp, impChain) {
        syntax.checks["if"](atoms, form);
        var tmp = expand(atoms[0], env, imp, impChain);
        var test = tmp.value;
        tmp = expand(atoms[1], tmp.env, imp, impChain);
        var then = tmp.value;
        tmp = expand(atoms[2], tmp.env, imp, impChain);
        var elss = tmp.value;
        var result = createForm("list", [symbols["if"]].concat(test).concat(then).concat(elss));
        return { value: result, env: tmp.env };
    }
    
    function expandFunc(atoms, form, env, imp, impChain) {
        syntax.checks.fn(atoms, form);
        var result = null, tmp = null;
        var args = atoms[0];
        var body = atoms.slice(1);
        if (args.type === "list") {
            var argNames = [];
            var argsList = args.value;
            var argsEnv = env;
            for (var i = 0, l = argsList.length; i < l; i++) {
                tmp = put(argsEnv, argsList[i].value);
                argNames[i] = createForm("symbol", tmp.id);
                argsEnv = tmp.env;
            }
            tmp = expandAll(body, argsEnv, imp, impChain);
            var newArgs = createForm("list", argNames);
            result = createForm("list", [symbols.fn, newArgs].concat(tmp.value));
        } else if (args.type === "symbol") {
            tmp = put(env, args.value);
            var restId = createForm("symbol", tmp.id);
            var restEnv = tmp.env;
            tmp = expandAll(body, restEnv, imp, impChain);
            result = createForm("list", [symbols.fn, restId].concat(tmp.value));
        }
        return { value: result, env: env };
    }
    
    function expandObject(atoms, form, env, imp, impChain) {
        syntax.checks.obj(atoms, form);
        var entries = [];
        for (var i = 0, l = atoms.length; i < l; i++) {
            var atom = atoms[i];
            var key = atom.value[0];
            var val = atoms.value[1];
            var tmp = expand(val, env, imp, impChain);
            entries[i] = createForm("list", [key, tmp.value]); 
            env = tmp.env;
        }
        var result = createForm("list", [symbols.obj].concat(entries));
        return { value: result, env: env };
    }
    
    function expandQuote(atoms, form, env) {
        syntax.checks.quote(atoms, form);
        return { value: form, env: env };
    }
    
    function expandQuasiQuote(atoms, form, env, imp, impChain) {
        syntax.checks.quasiquote(atoms, form);
        var sym = symbols.quasiquote;
        var tmp = expandQuasiQuoteValue(atoms[0], env, imp, impChain);
        return { value: createForm("list", [sym].concat(tmp.value)), env: env };
    }

    function expandQuasiQuoteValue(form, env, imp, impChain) {
        var tmp;
        if (form.type === "list") {
            var values = [];
            if (checkForm(form, "unquote")) {
                var sym = form.value[0];
                syntax.checks.unquote(form.value.slice(1), form);
                values = [sym];
                tmp = expand(form.value[1], env, imp, impChain);
                values = values.concat(tmp.value);
                env = tmp.env;
            } else if (checkForm(form, "unquote-splicing")) {
                error("unquote-splicing: not in list", form);
            } else {
                for (var i = 0, l = form.value.length; i < l; i++) {
                    if (checkForm(form.value[i], "unquote-splicing")) {
                        syntax.checks["unquote-splicing"](form.value[i].value.slice(1), form.value[i]);
                        tmp = expandQuasiQuoteValue(form.value[i].value[1], env, imp, impChain);
                        values = values.concat(tmp.value);
                        env = tmp.env;
                    } else {
                        tmp = expandQuasiQuoteValue(form.value[i], env, imp, impChain);
                        values = values.concat(tmp.value);
                        env = tmp.env;
                    }
                }
            }
            return { value: [createForm("list", values)], env: env };
        }
        return { value: [form], env: env };
    }
    
    function invalidUnquoteUse(atoms, form) {
        error(form.value[0] + ": not in quasiquote", form);
    }
    
    function expandDefineSyntax(atoms, form, env) {
        syntax.checks["define-syntax"](atoms, form);
        var syntaxId = atoms[0].value;
        var transformer = atoms[1];
        var rules = parseSyntaxRules(syntaxId, transformer.value.slice(1), transformer, env);
        var tmp = put(env, syntaxId, function (atoms, form, env, imp, impChain) {
            var result = null;
            for (var i = 0, l = rules.length; i < l; i++) {
                var rule = rules[i];
                var values = rule.pattern.run(atoms);
                if (values) {
                    result = rule.template.populate(values)[0];
                    break;
                }
            }
            if (result === null) {
                error(syntaxId + ": bad syntax", form);
            }
            return expand(result, env, imp, impChain);
        });
        return { value: [], env: tmp.env };
    }
    
    // ------------------------------------------------------------------------
    //  (syntax-rules ...)
    // ------------------------------------------------------------------------
    
    function parseSyntaxRules(syntaxId, atoms, form, env) {
        syntax.checks["syntax-rules"](atoms, form);
        
        var reserved = atoms[0].value.map(function (x) { return x.value; });
        var rules = atoms.slice(1);
        var result = [];
        
        for (var i = 0, l = rules.length; i < l; i++) {
            var rule = rules[i];
            var pattern = parsePattern(rule.value[0].value, syntaxId, reserved, true);
            var template = parseTemplate(rule.value[1], pattern.ids, env, reserved);
            result[i] = { pattern: pattern, template: template };
        }
        
        return result;
    }
    
    var patternReader = (function () {
       
        var match = function (val) {
            return function (state) {
                if (state.i >= state.input.length) {
                    return false;
                }
                var form = state.input[state.i++];
                return form.type === val.type && form.value === val.value;
            };
        };
        
        var matchList = function (val, limit) {
            return function (state) {
                if (state.i >= state.input.length) {
                    return false;
                }
                while (state.i < (state.input.length - limit)) {
                    var form = state.input[state.i++];
                    if (form.type !== val.type || form.value !== val.value) {
                        break;
                    }
                }
                return true;
            };
        };
        
        var bind = function (id) {
            return function (state) {
                if (state.i >= state.input.length) {
                    return false;
                }
                var form = state.input[state.i++];
                state.output[id] = form;
                return true;
            };
        };
        
        var bindList = function (id, limit) {
            return function (state) {
                var forms = [];
                while (state.i < (state.input.length - limit)) {
                    var form = state.input[state.i++];
                    forms.push(form);
                }
                state.output[id] = forms;
                return true;
            };
        };
        
        var readList = function (seq) {
            return function (state) {
                if (state.i >= state.input.length) {
                    return false;
                }
                var form = state.input[state.i++];
                if (form.type !== "list") {
                    return false;
                }
                var state1 = makeState(form.value);
                if (run(seq, state1)) {
                    state.output = util.copyProps(state1.output, state.output);
                    return true;
                }
                return false;
            };
        };     
        
        var readListList = function (seq, limit, outIds) {
            return function (state) {
                var outputs = [];
                while (state.i < (state.input.length - limit)) {
                    var form = state.input[state.i++];
                    if (form.type !== "list") {
                        break;
                    }
                    var state1 = makeState(form.value);
                    if (run(seq, state1)) {
                        outputs.push(state1.output);
                    } else {
                        break;
                    }
                }
                var combinedOutput = {};
                for (var k in outIds) {
                    if (outIds.hasOwnProperty(k)) {
                        combinedOutput[k] = [];
                    }
                }
                for (var i = 0, l = outputs.length; i < l; i++) {
                    for (k in outIds) {
                        if (outIds.hasOwnProperty(k)) {
                            combinedOutput[k].push(outputs[i][k]);
                        }
                    }
                }
                state.output = util.copyProps(combinedOutput, state.output);
                return true;
            };
        };
        
        var run = function (seq, state) {
            var i = 0, l = seq.length;
            while (i < l) {
                if (!seq[i++](state)) {
                    return false;
                }
            }
            return state.i === state.length && i === l;
        };
        
        var makeState = function (atoms) {
            return {
                input: atoms,
                i: 0,
                length: atoms.length,
                output: {}
            };
        };
        
        var create = function (seq, ids) {
            return function (atoms) {
                var state = makeState(atoms);
                return run(seq, state) ? state.output : null;
            };
        };
        
        return {
            match: match,
            matchList: matchList,
            bind: bind,
            bindList: bindList,
            readList: readList,
            readListList: readListList,
            create: create
        };
    
    }());
    
    function parsePattern(pat, syntaxId, reserved, isTopLevel) {
    
        if (isTopLevel === true) {
            var patId = pat[0].value;
            if (patId !== syntaxId && patId !== "_") {
                // TODO: this is more of a warning
                error("syntax-rules: pattern start identifier should be `_` or `" + patId + "`", pat[0]);
            }
        }
        
        var atoms = isTopLevel ? pat.slice(1) : pat;
        var tmp = parsePatternList(atoms, reserved, {});
        var ids = tmp.ids;
        var seq = tmp.seq;
        
        return {
            temp: atoms.map(util.printPretty).join(" "),
            ids: ids,
            run: patternReader.create(seq, ids)
        };
    }
    
    function parsePatternList(atoms, reserved, outerIds) {
        var seq = [];
        var doneEllipsis = false;
        var ids = {};
        
        for (var i = 0, l = atoms.length; i < l; i++) {
            
            var atom = atoms[i];
            
            // Is the current atom followed by ellipsis?
            var hasEllipsis = i < atoms.length - 1 && 
                              atoms[i + 1].type === "symbol" && 
                              atoms[i + 1].value === "...";
                              
            if (doneEllipsis && hasEllipsis) {
                error("sytax-rules: invalid ellipsis usage - follows other ellipsis", atom);
            }

            // How many sub-patterns are there after the ellipsis?
            var ellipsisLimit = hasEllipsis ? (atoms.length - 2) - i: 0;
            
            if (atom.type === "symbol") {
            
                if (atom.value === "...") {
                    error("sytax-rules: invalid ellipsis usage - no pattern variables before ellipsis", atom);
                }
                
                if (reserved.indexOf(atom.value) !== -1) {
                    if (hasEllipsis) {
                        seq.push(patternReader.matchList(atom, ellipsisLimit));
                    } else {
                        seq.push(patternReader.match(atom));
                    }
                } else {
                    if (ids.hasOwnProperty(atom.value) || outerIds.hasOwnProperty(atom.value)) {
                        error("syntax-rules: variable appears twice in pattern", atom);
                    }
                    if (hasEllipsis) {
                        ids[atom.value] = 1;
                        seq.push(patternReader.bindList(atom.value, ellipsisLimit));
                    } else {
                        ids[atom.value] = 0;
                        seq.push(patternReader.bind(atom.value));
                    }
                }
                
            } else if (atom.type === "literal") {
            
                if (hasEllipsis) {
                    seq.push(patternReader.matchList(atom, ellipsisLimit));
                } else {
                    seq.push(patternReader.match(atom));
                }
                
            } else if (atom.type === "list") {
            
                var tmp;
            
                if (hasEllipsis) {
                
                    tmp = parsePatternList(atom.value, reserved, ids);
                    for (var k in tmp.ids) {
                        if (tmp.ids.hasOwnProperty(k)) {
                            tmp.ids[k]++;
                        }
                    }
                    ids = util.copyProps(tmp.ids, ids);
                    seq.push(patternReader.readListList(tmp.seq, ellipsisLimit, tmp.ids));
                    
                } else {
                
                    tmp = parsePatternList(atom.value, reserved, ids);
                    ids = util.copyProps(tmp.ids, ids);
                    seq.push(patternReader.readList(tmp.seq, ellipsisLimit));
                    
                }
            } 
            
            if (hasEllipsis) {
                i++;
                doneEllipsis = true;
            }
        }
        return { seq: seq, ids: ids };
    }
    
    
    var templateWriters = (function () {
    
        function writeForm(form) {
            return function () {
                return [form];
            };
        }
    
        function writeSymbol(template, patIds, env, reserved) {
            // TODO: warn/info about using reserved ids in template
            if (patIds.hasOwnProperty(template.value)) {
                if (patIds[template.value] > 0) {
                    error("syntax-rules: pattern variable '" + template.value + "' has too few ellipses", template);
                }
                return function (tenv) {
                    return [tenv[template.value]];
                };
            }
            if (env.hasOwnProperty(template.value)) {
                var ev = get(env, template.value);
                // TODO: not sure about this - if env has the id as a 
                //       function, it's because it's bound to a macro in
                //       the current scope. just making a reference to that
                //       id isn't right, it should be bound to the macro 
                //       that currently has that id instead. this is also
                //       quote-sensitive.
                if (typeof ev === "function") {
                    return writeForm(createForm("symbol", template.value));
                } else {
                    return writeForm(createForm("symbol", ev));
                }
            }
            return writeForm(createForm("symbol", template.value));
        }
        
        function findIds(template, patIds) {
            if (template.type === "literal") {
                return [];
            }
            if (template.type === "symbol") {
                return [template.value];
            }
            var atoms = template.value;
            var ids = [];
            for (var i = 0, l = atoms.length; i < l; i++) {
                var atom = atoms[i];
                if (atom.type === "symbol" && patIds.hasOwnProperty(atom.value)) {
                    ids.push(atom.value);
                }
            }
            return ids;
        }
        
        function createEllipsisWriter(inner, ids) {
            return function (tenv) {
                var length = -1;
                for (var i = 0, l = ids.length; i < l; i++) {
                    var val = tenv[ids[i]];
                    if (length === -1) {
                        length = val.length;
                    } else if (val.length !== length) {
                        // TODO: a decent error message!
                        error("macro expansion: ellipsis lists differ in length");
                    }
                }
                var result = [];
                for (var j = 0; j < length; j++) {
                    var tenv1 = util.copyProps(tenv, {});
                    for (i = 0; i < l; i++) {
                        var id = ids[i];
                        tenv1[id] = tenv1[id][j];
                    }
                    result = result.concat(inner(tenv1));
                }
                return result;
            };
        }
        
        function listItemWriter(atom, patIds, env, reserved, numEllipsis) {
            if (numEllipsis === 0) {
                return create(atom, patIds, env, reserved);
            } else {
                var ids = findIds(atom, patIds);
                var patIds1 = util.copyProps(patIds, {});
                for (var j = 0, m = ids.length; j < m; j++) {
                    if (patIds1[ids[j]] > 0) {
                        patIds1[ids[j]]--;
                    } else {
                        error("syntax-rules: too many ellipses in template", atom)
                    }
                }
                var inner = listItemWriter(atom, patIds1, env, reserved, numEllipsis - 1);
                return createEllipsisWriter(inner, ids); 
            }
        }
        
        function writeList(template, patIds, env, reserved) {
        
            var atoms = template.value;
            
            // Keep () as ()
            if (atoms.length === 0) {
                return writeForm(template);
            }
            
            // Expand `(... ...)` to `...`
            if (atoms[0].type === "symbol" && atoms[0].value === "..." &&
                atoms[1].type === "symbol" && atoms[1].value === "...") {
                return writeForm(symbols["..."]);
            }
            
            var writers = [];
            var usedIds = [];
            var tmp;

            for (var i = 0, l = atoms.length; i < l; i++) {
                var atom = atoms[i];
                var numEllipsis = 0;
                
                while (i < atoms.length - 1 && 
                       atoms[i + 1].type === "symbol" && 
                       atoms[i + 1].value === "...") {
                    numEllipsis++;
                    i++;
                }
                
                writers.push(listItemWriter(atom, patIds, env, reserved, numEllipsis));
            }
            
            return function (tenv) {
                var result = [];
                for (var i = 0, l = writers.length; i < l; i++) {
                    var value = writers[i](tenv);
                    result = result.concat(value);
                }
                return [createForm("list", result)];
            };
        }
        
        // TODO: templates need to be quote-aware, so symbols are not rewritten
        //       using env mapping if they are quoted. basically 'a should 
        //       always be 'a and not become 'a25 or whatever.
        
        function create(atom, patIds, env, reserved) {
            if (atom.type === "symbol") {
                return writeSymbol(atom, patIds, env, reserved);
            }
            if (atom.type === "list") {
                return writeList(atom, patIds, env, reserved);
            }
            return writeForm(atom);
        }
    
        return {
            create: create
        };
    
    }());
    
    function parseTemplate(template, patIds, env, reserved) {
        return {
            populate: templateWriters.create(template, patIds, env, reserved)
        };
    }
    
    function invalidSyntaxRulesUse(atoms, form) {
        error("syntax-rules: not in define-syntax", form);
    }
    
    // ------------------------------------------------------------------------
    //  Import analysis
    // ------------------------------------------------------------------------
    
    function findImports(form, inQuasiQuote) {
        if (inQuasiQuote === true && (checkForm(form, "unquote") || checkForm(form, "unquote-splicing"))) {
            return findImports(form.value[1], false);
        }
        if (inQuasiQuote !== true && checkForm(form, "quote")) {
            return [];
        }
        if (checkForm(form, "quasiquote")) {
            return findImports(form.value[1], true);
        }
        if (checkForm(form, "import")) {
            return form.value.slice(1).map(function (x) { return x.value; });
        }
        if (form.type === "list") {
            return findAllImports(form.value, inQuasiQuote);
        }
        return [];
    }
    
    function findAllImports(forms, inQuasiQuote) {
        var result = [];
        for (var i = 0, l = forms.length; i < l; i++) {
            result = result.concat(findImports(forms[i], inQuasiQuote));
        }
        return result;
    }
    
    // ------------------------------------------------------------------------
    //  Main
    // ------------------------------------------------------------------------
    
    function expand(form, env, imp, impChain) {
        var result = form;
        if (form.type === "list" && form.value.length > 0) {
            var car = form.value[0];
            var cdr = form.value.slice(1);
            if (car.type === "symbol") {
                if (env.hasOwnProperty(car.value)) {
                    var ev = get(env, car.value);
                    if (typeof ev === "function") {
                        return ev(cdr, form, env, imp, impChain);
                    }
                } else if (car.value.charAt(0) === "." && car.value.length > 1) {
                    return expandShortProp(form, env, imp, impChain);
                }
            }
            var tmp = expandAll(form.value, env, imp, impChain);
            result = createForm("list", tmp.value);
            env = tmp.env;
        } else if (form.type === "symbol" && env.hasOwnProperty(form.value)) {
            var sym = get(env, form.value);
            if (typeof sym === "function") {
                error(form.value + ": bad syntax", form);
            }
            result = createForm("symbol", sym);
        }
        return { value: result, env: env };
    }
    
    function expandAll(seq, env, imp, impChain) {
        var result = [];
        
        for (var i = 0, l = seq.length; i < l; i++) {
            var tmp = expand(seq[i], env, imp, impChain);
            result = result.concat(tmp.value);
            env = tmp.env;
        }
        return { value: result, env: env };
    }
    
    function expandScript(forms, handleImport, k) {
        var env = {
            "import": expandImport,
            "var": expandVar,
            "fn": expandFunc,
            ".": expandProp,
            "set!": expandAssign,
            "if": expandIf,
            "quote": expandQuote,
            "quasiquote": expandQuasiQuote,
            "unquote": invalidUnquoteUse,
            "unquote-splicing": invalidUnquoteUse,
            "define-syntax": expandDefineSyntax,
            "syntax-rules": invalidSyntaxRulesUse
        };
        var imports = findAllImports(forms);
        var imported = {};
        var loadNextImport = function () {
            while (imports.length > 0 && imported.hasOwnProperty(imports[0])) {
                imports.shift();
            }
            if (imports.length > 0) {
                var name = imports.shift();
                handleImport(name, function (splice) {
                    imports = imports.concat(findAllImports(splice));
                    imported[name] = splice;
                    loadNextImport();
                });
            } else {
                k(expandAll(forms, env, imported, {}).value);
            }
        };
        loadNextImport();
    }

    return { expand: expandScript };

});