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
    
    function expandDefineSyntax(atoms, env, imp, impChain) {
        // TODO: require that free identifiers in templates have already been declared to ensure predictable expansion
        var formId = atoms[0].value;
        var rules = atoms[1];
        var reserved = atoms[1].value[1].value.map(function (x) { return x.value; });
        
        console.log(formId, reserved);
        rules = rules.value.slice(2);
        
        for (var i = 0, l = rules.length; i < l; i++) {
            var rule = rules[i];
            var pattern = rule.value[0];
            var template = rule.value[1];
            console.log("pat:", util.printPretty(pattern));
            console.log("tem:", util.printPretty(template));
        }
        
        return { value: [], env: env };
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
            if (car.type === "symbol" && !env.hasOwnProperty(car.value)) {
                var syntaxCheck = syntax.checks[car.value];
                if (syntaxCheck) {
                    syntaxCheck(cdr, form);
                }
                var expander = expanders[car.value];
                if (expander) {
                    return expander(cdr, form, env, imp, impChain);
                }
            }
            var tmp = expandAll(form.value, env, imp, impChain);
            result = createForm("list", tmp.value);
            env = tmp.env;
        } else if (form.type === "symbol" && env.hasOwnProperty(form.value)) {
            result = createForm("symbol", get(env, form.value));
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