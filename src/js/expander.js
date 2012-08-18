/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util", "syntax"], function (util, syntax) {

    "use strict";
    
    var checkForm = util.checkForm;
    var createForm = util.createForm;
    
    // TODO: expander needs to perform identifier remapping instead of waiting 
    // until the compile stage - this is necessary to maintain macro hygiene 
    // when free identifiers are used in macro templates, as free identifiers 
    // need to refer to the identifier in the macro's scope:
    // e.g. if macro `m1` is rewritten to `a`:
    // (var a 50)
    // (m1); = 50
    // (let ((a 1000)) (m1)) ; still = 50
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printRawForm(form));
    }
    
    // ------------------------------------------------------------------------
    //  Expand transforms
    // ------------------------------------------------------------------------
    
    function expandImport(atoms, form, imp, impChain) {
        var result = [];
        for (var i = 0, l = atoms.length; i < l; i++) {
            var name = atoms[i].value;
            if (!impChain.hasOwnProperty(name)) {
                impChain = util.copyProps(impChain, {});
                impChain[name] = true;
                result = result.concat(expandAll(imp[name], imp, impChain));
            }
        }
        return result;
    }
    
    function expandQuote() {
        return arguments[1];
    }
    
    function expandQuasiQuote(atoms, form, imp, impChain) {
        var sym = createForm("symbol", "quasiquote");
        var val = expandQuasiQuoteValue(atoms[0], imp, impChain);
        return createForm("list", [sym].concat(val));
    }
    
    function expandQuasiQuoteValue(form, imp, impChain) {
        if (form.type === "list") {
            var values = [];
            if (checkForm(form, "unquote") || checkForm(form, "unquote-splicing")) {
                values = [form.value[0]];
                values = values.concat(expand(form.value[1], imp, impChain));
            } else {
                for (var i = 0, l = form.value.length; i < l; i++) {
                    values = values.concat(expandQuasiQuoteValue(form.value[i], imp, impChain));
                }
            }
            return [createForm("list", values)];
        }
        return [form];
    }
    
    /*function expandDefineSyntax(atoms, imp, impChain) {
        // TODO: require that free identifiers in templates have already been declared to ensure predictable expansion
        var id = getSymbolValue(atoms[0]);
        var rules = atoms[1];
        var reserved = atoms[1].value[1].value.map(getSymbolValue);
        
        console.log(id, reserved);
        rules = rules.value.slice(2);
        
        for (var i = 0, l = rules.length; i < l; i++) {
            var rule = rules[i];
            var pattern = rule.value[0];
            var template = rule.value[1];
            console.log("pat:", util.printPretty(pattern));
            console.log("tem:", util.printPretty(template));
        }
        
        return [];
    }*/
    
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
        "quote": expandQuote,
        "quasiquote": expandQuasiQuote
        //"define-syntax": expandDefineSyntax
    };

    function expand(form, imp, impChain) {
        if (form.type === "list" && form.value.length > 0) {
            var car = form.value[0];
            var cdr = form.value.slice(1);
            if (car.type === "symbol") {
                var syntaxCheck = syntax.checks[car.value];
                if (syntaxCheck) {
                    syntaxCheck(cdr, form);
                }
                var expander = expanders[car.value];
                if (expander) {
                    return expander(cdr, form, imp, impChain);
                }
            }
            return createForm("list", expandAll(form.value, imp, impChain));
        }
        return form;
    }
    
    function expandAll(seq, imp, impChain) {
        var result = [];
        for (var i = 0, l = seq.length; i < l; i++) {
            result = result.concat(expand(seq[i], imp, impChain));
        }
        return result;
    }
    
    function expandScript(forms, handleImport, k) {
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
                k(expandAll(forms, imported, {}));
            }
        };
        loadNextImport();
    }

    return { expand: expandScript };

});