[![Build Status](https://travis-ci.org/HexRweb/hookit.svg?branch=master)](https://travis-ci.org/HexRweb/hookit)
[![Coverage Status](https://coveralls.io/repos/github/HexRweb/hookit/badge.svg?branch=master)](https://coveralls.io/github/HexRweb/hookit/?branch=master)

_Don't like the documentation? Help us make it better by emailing us (hello@hexr.org), [creating an issue](https://github.com/hexrweb/hookit/issues/new) or [creating a pull request](https://github.com/hexrweb/hookit/compare)_


# Hookit

Application hooks made simple

# What? Why?

The ability to extend the functionality of applications is something tech-lovers, developers, and everyone else have wanted. However, providing an easy mechanism for the extension can be cumbersome.

Enter Hookit. Hookit's goal is to make application lifecycle hooks simple and manageable.

# Getting Started

Getting started is simple!

```bash
npm install @hexr/hookit --save --production
```

Hookit is designed to be minimal - there's only one dependency, [bluebird](http://bluebirdjs.org), for Promise-based iteration functions. Hopefully installation is lightning:zap: fast!

# Documentation

Hookit exports a `HookManager` - this performs similar functions to the Router in web frameworks (like express) - it takes in information, determines where to send it, and responds with the processed information.

To use it, first instantiate it -
```js
const HookManager = require('@hexr/hookit');
const hooks = new HookManager();
```

The HookManager constructor doesn't take any options.

Now that you've instantiated your HookManager, it's time to tell it what hooks your application supports. You can do this whenever you want, but you _must_ add the hook before you register extension hooks.

```js
// Valid ways to add a hook
hooks.addHook('before-save', true, beforeSaveMergerFn);
hooks.addHook('register-components', false, registerComponentsMergerFn);
hooks.addHook('bootstrap');

// Function structure
addHook(hookName: String, [hookIsSynchronous: Boolean = false], [mergerFunction: Function = noop])
```

the `addHook` method takes 3 arguments - the hook name, whether the hook is synchronous, and the merger function

- The hook name is how you identify the hook - basically a Hook ID. For example, if you have a content generation application, you might have a `before-save` hook which allows extensions to modify the data via the hook (for example, spellcheck). It's name is `before-save`, because it describes when the hook is run.

 - hookIsSynchronous tells HookManager how to process the hooks. A general rule of thumb is if your hooks are providing data (i.e. providing additional components to register), the hook will be asynchronous, but if the hook is modifying data (i.e. text replacements in a `before-save` hook), it will be synchronous. Sync functions use `Promise.reduce` (similar to Array.reduce, this functionality is provided by bluebird) and async functions use `Promise.mapSeries` (similar to Array.map, this functionality is also provided by bluebird)

 - The merger function handles parsing and reducing the data that was provided by all of the hooks. By default, a noop (passthrough) function is used, but you can create your own function. Here's an example of what you might use:

   `const registerComponentsMergerFn = (newComponents, appComponentsList) => appComponentsList.concat(newComponents);`

   We will go a bit more in depth about the merger function in the `executeHook` section

Now that HookManager knows what hooks your application uses, your extensions can now hook into them!

```js
const extensions = {
    "extensionA": [Class ExtensionA],
    "extensionB": [Class ExtensionB]
    // ...
};

// First register your own hooks
registerInternalHooks(hooks.generateHookRegisterer());

// Now let your extensions register their hooks
Object.getOwnPropertyNames(extensions).forEach((extension) => {
	extensions[extension].registerHooks(hooks.generateHookRegisterer(extension))
});

// Structure
const registerHook = generateHookRegisterer([caller: String = 'default']);
registerHook(hookName: String, action: Function);
```

This might seem a bit confusing at first - you might be asking "What's the point of `generateHookRegisterer`? Why can't I just directly register hooks?" Well the answer is simple - when you're hooking extensions into your application, you need to maintain a level of control over them. As an application developer, you expect certain things to work in certain ways, and extensions can interfere with that. The goal of having `generateHookRegisterer` is to allow you (the developer) to do be able to associate an extension with its actions. If you don't want to worry about this, you can just do something like `const registerHook = hooks.generateHookRegisterer();` and then use`registerHook` for your hook registrations

**&lt;Example>**

There are many use cases for _why_ to use `generateHookRegisterer`, but one of the simplest ones is namespace collision prevention - say you allow your extensions call into a `mount-endpoints` hook, where they can add additional endpoints which will be mounted. Your application is documented to expose `/authenticate/` as the authentication endpoint. What happens when the `oauth` extension hooks in, and wants to mount to `/authenticate/`? Best case scenario, it successfully mounts to `/authenticate/`, but the handler is never called since your handler takes precedence. Worst case scenario is your application crashes. What can you do to prevent either of these? Add collision detection - for example

```js
// arguments are generated / provided in executeHook
const mountEndpointsMergerFn = (hookResults, myEndpoints) => {
// hookResults = [Object: {from: hookName (String), result: hookResult (any)}]
    return hookResults.reduce((endpoints, singleHookResult) => {
        validate(singleHookResult.result);
        singleHookResult.result.forEach(endpoint => {
            // This is really basic collision detection, used for the proof of concept
            if (endpoints[endpoint.name]) {
                endpoint.name = `${singleHookResult.from}-${endpoint.name}`;
            }
            endpoints[endpoint.name] = endpoint;
        });
    }, myEndpoints);
};

// mount-endpoints is an async hook
hooks.addHook('mount-endpoints', false, mountEndpointsMergerFn);
```

**&lt;/example>**

Now that your extensions have registered their hooks, it's time to execute the hooks at the proper time.

```js
// (super awesome application logic)

// time to register components!

hooks.executeHook('register-components', [myComponents], utilities).then(componentsList => {
	// (more super awesome application logic)
});

// structure for async hooks
hook.executeHook(hookID: String, mergerArgs: Array = [], ...hookArgs: any)
// structure for sync (reduced) hooks
hook.executeHook(hookID: String, mergerArgs: Array = [], initialValue: any, ...hookArgs: any)
```

Runtime Hook execution is done through the `executeHook` function of an instantiated HookManager. Based on synchronity of the hook, the registered hooks will be mapped (async) or reduced (sync), with the results being passed to the `mergerFunction` that was defined in the registration process.

Arguments:
 - `hookID` - the ID of the hook; this is the first argument that was passed to addHook (i.e. `beforeSave`)
 - `mergerArgs` - An array of arguments to pass to the merger function. The merger function will be called like `fn(results, ...mergerArgs)`
 - (Sync only) `initialValue` - the initial value for the resolver. In the `beforeSave` example, this will be the content to be saved (i.e post content)
 - `...hookArgs` - the arguments to be passed to the hook; for sync hooks, the hook will be called like `fn(currentValue, ...hookArgs)`, and for async functions, `fn(...hookArgs)`

# TL;DR

- We don't have this at the moment :grimacing: If you have time, feel free to [contribute](#contributing)!

# Issues and Support

Feel free to create an issue if you have any questions, feature requests or found a bug. As of now, there's no specific template, but if this gets too much traction, something will be put in place. If you want to contact us directly, shoot us an email - hello@hexr.org

# Contributing

Feel free to create a Pull Request if you think any changes should be made. You don't have to explain yourself, but be able to if requested.