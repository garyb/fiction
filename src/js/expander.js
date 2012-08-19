/*jshint devel: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, strict: true*/
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
    
    var natives = util.makeMap([
        "import", 
        "var", "fn", "set!", "if", 
        "quote", "quasiquote", "unquote", "unquote-splicing"
    ]);
    
    function put(env, id) {
        var newId = id;
        if (env.hasOwnProperty(newId) || natives.hasOwnProperty(newId)) {
            var n = 1;
            while (env.hasOwnProperty(newId + n) || natives.hasOwnProperty(newId + n)) {
                n++;
            }
            newId += n.toString();
        }
        var result = util.copyProps(env, {});
        result[id] = newId;
        result[newId] = newId;
        return { id: newId, env: result };
    }
    
    function get(env, id, form) {
        if (env.hasOwnProperty(id)) {
            return env[id];
        } else {
            error("Undefined identifier '" + id + "'", form);
        }
    }
    
    // ------------------------------------------------------------------------
    //  Expand transforms
    // ------------------------------------------------------------------------
    
    var symbols = {
        "var": createForm("symbol", "var"),
        "fn": createForm("symbol", "fn"),
        "quasiquote": createForm("symbol", "quasiquote")
    };
    
    function expandImport(atoms, form, env, imp, impChain) {
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
        var tmp = put(env, atoms[0].value);
        var id = createForm("symbol", tmp.id);
        tmp = expand(atoms[1], tmp.env, imp, impChain);
        var result = createForm("list", [symbols["var"], id].concat(tmp.value));
        return { value: result, env: tmp.env };
    }
    
    function expandFunc(atoms, form, env, imp, impChain) {
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
    
    function expandQuote() {
        return { value: arguments[1], env: arguments[2] };
    }
    
    function expandQuasiQuote(atoms, form, env, imp, impChain) {
        var sym = symbols.quasiquote;
        var tmp = expandQuasiQuoteValue(atoms[0], env, imp, impChain);
        return { value: createForm("list", [sym].concat(tmp.value)), env: env };
    }
    
    function expandQuasiQuoteValue(form, env, imp, impChain) {
        var tmp;
        if (form.type === "list") {
            var values = [];
            if (checkForm(form, "unquote") || checkForm(form, "unquote-splicing")) {
                values = [form.value[0]];
                tmp = expand(form.value[1], env, imp, impChain);
                values = values.concat(tmp.value);
                env = tmp.env;
            } else {
                for (var i = 0, l = form.value.length; i < l; i++) {
                    tmp = expandQuasiQuoteValue(form.value[i], env, imp, impChain);
                    values = values.concat(tmp.value);
                    env = tmp.env;
                }
            }
            return { value: [createForm("list", values)], env: env };
        }
        return { value: [form], env: env };
    }
    
    function expandDefineSyntax(atoms, form, env, imp, impChain) {
        var syntaxId = atoms[0].value;
        var transformer = atoms[1];
        
        var rules = parseSyntaxRules(syntaxId, transformer.value.slice(1), transformer, env);
        
        // TODO: this env modification should be possible via put
        env = util.copyProps(env, {});
        env[syntaxId] = function (atoms, form, env, imp, impChain) {
            var result = null;
            for (var i = 0, l = rules.length; i < l; i++) {
                var rule = rules[i];
                var values = rules[i].pattern.run(atoms);
                if (values) {
                    result = rules[i].template.populate(values);
                    break;
                }
            }
            if (result === null) {
                error(syntaxId + ": bad syntax");
            }
            return expand(result, env, imp, impChain);
        };
        return { value: [], env: env };
    }
    
    // ------------------------------------------------------------------------
    //  (syntax-rules ...)
    // ------------------------------------------------------------------------
    
    function parseSyntaxRules(syntaxId, atoms, form, env) {
        syntax.checks["syntax-rules"](atoms, form);
        
        // TODO: require that free identifiers in templates have already been declared to ensure predictable expansion
        
        var reserved = atoms[0].value.map(function (x) { return x.value; });
        var rules = atoms.slice(1);
        var result = [];
        
        for (var i = 0, l = rules.length; i < l; i++) {
            var rule = rules[i];
            var pattern = parsePattern(rule.value[0].value, syntaxId, reserved, true);
            var template = parseTemplate(rule.value[1], pattern.ids, env, reserved);
            
            // TODO: check pattern/template semantics to ensure proper usage of ellipsis in template
            
            result[i] = { pattern: pattern, template: template };
        }
        
        return result;
    }
    
    var patternReader = (function () {
       
        var match = function (val) {
            if (val.type === "list") {
                throw new Error("match only works for symbols and literals");
            }
            return function (state) {
                var form = state.input[state.i++];
                return form.type === val.type && form.value === val.value;
            };
        };
        
        var matchList = function (val, limit) {
            return function (state) {
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
                var form = state.input[state.i++];
                state.bind(id, form);
                return true;
            };
        };
        
        var bindList = function (id) {
            return function (state) {
                var forms = [];
                while (state.i < state.input.length) {
                    var form = state.input[state.i++];
                    forms.push(form);
                }
                state.bind(id, forms);
                return true;
            };
        };
        
        var create = function (seq) {
            return function (atoms) {
                var state = {
                    input: atoms,
                    i: 0,
                    length: atoms.length,
                    output: {},
                    bind: function (id, value) {
                        state.output[id] = value;
                    }
                };
                var i = 0, l = seq.length;
                while (state.i < state.length && i < l) {
                    if (!seq[i++](state)) {
                        break;
                    }
                }
                if (state.i !== state.length) {
                    return null;
                }
                return state.output;
            };
        };
        
        return {
            match: match,
            matchList: matchList,
            bind: bind,
            bindList: bindList,
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
        var seq = [];
        var doneEllipsis = false;
        
        // TODO: need to increment all id values as needed when sub pattern is ellipsised
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
                throw new Error("can't do sub-patterns yet");
            } 
            
            if (hasEllipsis) {
                i++;
                doneEllipsis = true;
            }
        }
        
        return {
            temp: atoms.map(util.printPretty).join(" "),
            ids: ids,
            run: patternReader.create(seq)
        };
    }
    
    function parseTemplate(template, patIds, env, reserved) {
        // TODO: warn/info about using reserved ids in template
        // TODO: warn about using free ids in template that are not yet declared
        // TODO: both of the above need to be quote-aware, as a quoted free id 
        //       is just a symbol. this might not actually be possible - if 
        //       another macro is used in the template, unless it can be
        //       expanded at template-define-time, there is no way of knowing 
        //       whether a symbol is being used as an identifier or just in a 
        //       quote.
        
        var apply = function (template, tenv) {
            if (template.type === "literal") {
                return template;
        
            } else if (template.type === "symbol") {
                
                if (patIds.hasOwnProperty(template.value)) {
                    return tenv[template.value];
                } else if (env.hasOwnProperty(template.value)) {
                    var ev = get(env, template.value);
                    if (typeof ev === "function") {
                        return createForm("symbol", template.value);
                    } else {
                        return createForm("symbol", ev);
                    }
                } else {
                    return createForm("symbol", template.value);
                }
            
            } else if (template.type === "list") {
            
                var atoms = template.value;
                var values = [];
                
                if (atoms.length === 0) {
                    return createForm("list", []);
                }
                
                // Replace `(... ...)` with `...`
                if (atoms[0].type === "symbol" && atoms[0].value === "..." &&
                    atoms[1].type === "symbol" && atoms[1].value === "...") {
                    return createForm("symbol", "...");
                }

                for (var i = 0, l = atoms.length; i < l; i++) {
                    var atom = atoms[i];
                    
                    var hasEllipsis = i < atoms.length - 1 && 
                              atoms[i + 1].type === "symbol" && 
                              atoms[i + 1].value === "...";
                              
                    var value = apply(template.value[i], tenv);
                    
                    if (hasEllipsis) {
                        values = values.concat(value);
                    } else {
                        if (Array.isArray(value)) {
                            error("something went wrong, non ... pattern returned array", atom);
                        }   
                        values.push(value);
                    }
                    
                    if (hasEllipsis) {
                        i++;
                    }
                }
                return createForm("list", values);
            }
        };
        
        return {
            populate: function (tenv) {
                var result = apply(template, tenv);
                if (Array.isArray(result)) {
                    error("Something went wrong, template expanded into multiple forms", template);
                }
                return result;
            }
        };
        
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
    
    var expanders = {
        "import": expandImport,
        "var": expandVar,
        "fn": expandFunc,
        "quote": expandQuote,
        "quasiquote": expandQuasiQuote,
        "define-syntax": expandDefineSyntax
    };

    function expand(form, env, imp, impChain) {
        var result = form;
        if (form.type === "list" && form.value.length > 0) {
            var car = form.value[0];
            var cdr = form.value.slice(1);
            if (car.type === "symbol") {
            
                if (env.hasOwnProperty(car.value)) {
                    // TODO: hacked in support for macro scoping. This is 
                    // basically what needs to happen, but needs some refinement
                    // to ensure transformers are never used as symbols anywhere
                    var ev = get(env, car.value);
                    if (typeof ev === "function") {
                        return ev(cdr, form, env, imp, impChain);
                    }
                } else {
                    var syntaxCheck = syntax.checks[car.value];
                    if (syntaxCheck) {
                        syntaxCheck(cdr, form);
                    }
                    var expander = expanders[car.value];
                    if (expander) {
                        return expander(cdr, form, env, imp, impChain);
                    }
                }
            }
            var tmp = expandAll(form.value, env, imp, impChain);
            result = createForm("list", tmp.value);
            env = tmp.env;
        } else if (form.type === "symbol" && env.hasOwnProperty(form.value)) {
            var sym = get(env, form.value);
            if (typeof sym === "function") {
                sym = form.value;
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
        var env = {};
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