//   Disapproval.js 0.1.0
//   (c) 2014 Aaron O'Connell, 42Floors
// 
//   with lots of the internals taken from Backbone.js
//   (c) 2010-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//   http://backbonejs.org
// 
//   Disapproval may be freely distributed under the MIT license.

(function (root, factory) {

  // Set up O_o appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function (_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global O_o.
      root.O_o = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore');
    factory(root, exports, _);

  // Finally, as a browser global.
  } else {
    root.O_o = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(this, function (root, O_o, _, $) {

  var previousO_o = root.O_o;

  // Create local references to array methods we'll want to use later.
  var array = [];
  var slice = array.slice;

  // Current version of the library. Keep in sync with `package.json`.
  O_o.VERSION = '0.1.0';

  // For O_o's purposes, jQuery, Zepto, or Ender owns the `$` variable.
  O_o.$ = $;

  // Runs O_o.js in *noConflict* mode, returning the `O_o` variable
  // to its previous owner. Returns a reference to this O_o object.
  O_o.noConflict = function () {
    root.O_o = previousO_o;
    return this;
  };

  var Events = O_o.Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function (name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({ callback: callback, context: context, ctx: context || this });
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function (name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function () {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function (name, callback, context) {
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;

      // Remove all callbacks for all events.
      if (!name && !callback && !context) {
        this._events = void 0;
        return this;
      }

      var names = name ? [name] : _.keys(this._events);
      for (var i = 0, length = names.length; i < length; i++) {
        name = names[i];

        // Bail out if there are no events stored.
        var events = this._events[name];
        if (!events) continue;

        // Remove all callbacks for this event.
        if (!callback && !context) {
          delete this._events[name];
          continue;
        }

        // Find any remaining events.
        var remaining = [];
        for (var j = 0, k = events.length; j < k; j++) {
          var event = events[j];
          if (
            callback && callback !== event.callback &&
            callback !== event.callback._callback ||
            context && context !== event.context
          ) {
            remaining.push(event);
          }
        }

        // Replace events if there are any remaining.  Otherwise, clean up.
        if (remaining.length) {
          this._events[name] = remaining;
        } else {
          delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function (name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function (obj, name, callback) {
      var listeningTo = this._listeningTo;
      if (!listeningTo) return this;
      var remove = !name && !callback;
      if (!callback && typeof name === 'object') callback = this;
      if (obj) (listeningTo = {})[obj._listenId] = obj;
      for (var id in listeningTo) {
        obj = listeningTo[id];
        obj.off(name, callback, this);
        if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{ change: action }`
  // in terms of the existing API.
  var eventsApi = function (obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, length = names.length; i < length; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // O_o events have 3 arguments).
  var triggerEvents = function (events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  var listenMethods = { listenTo: 'on', listenToOnce: 'once' };

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function (implementation, method) {
    Events[method] = function (obj, name, callback) {
      var listeningTo = this._listeningTo || (this._listeningTo = {});
      var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
      listeningTo[id] = obj;
      if (!callback && typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Allow the `O_o` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(O_o, Events);


  // O_o.Model
  // --------------

  // O_o **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = O_o.Model = function (attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId('c');
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function () {},

    // Return a copy of the model's `attributes` object.
    toJSON: function (options) {
      return _.clone(this.attributes);
    },

    // Get the value of an attribute.
    get: function (attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function (attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function (attr) {
      return this.get(attr) != null;
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function (key, val, options) {
      var attr, attrs, unset, changes, silent, changing, prev, current;
      if (key == null) return this;

      // Handle both `"key", value` and `{ key: value }` -style arguments.
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Extract attributes and options.
      unset           = options.unset;
      silent          = options.silent;
      changes         = [];
      changing        = this._changing;
      this._changing  = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }
      current = this.attributes, prev = this._previousAttributes;

      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // For each `set` attribute, update or delete the current value.
      for (attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          this.changed[attr] = val;
        } else {
          delete this.changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0, length = changes.length; i < length; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function (attr, options) {
      return this.set(attr, void 0, _.extend({}, options, { unset: true }));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function (options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, { unset: true }));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function (attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function (diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var val, changed = false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      for (var attr in diff) {
        if (_.isEqual(old[attr], (val = diff[attr]))) continue;
        (changed || (changed = {}))[attr] = val;
      }
      return changed;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function (attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function () {
      return _.clone(this._previousAttributes);
    },

    // Create a new model with identical attributes to this one.
    clone: function () {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function () {
      return !this.has(this.idAttribute);
    }
  });

  // Underscore methods that we want to implement on the Model.
  var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit', 'chain', 'isEmpty'];

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  _.each(modelMethods, function (method) {
    if (!_[method]) return;
    Model.prototype[method] = function () {
      var args = slice.call(arguments);
      args.unshift(this.attributes);
      return _[method].apply(_, args);
    };
  });


  // O_o.Collection
  // -------------------

  // If models tend to represent a single row of data, a O_o Collection is
  // more analogous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = O_o.Collection = function (models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({ silent: true }, options));
  };

  // Default options for `Collection#set`.
  var setOptions = { add: true, remove: true, merge: true };
  var addOptions = { add: true, remove: false };

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function () {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // The default model for a collection is just a **O_o.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function () {},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function (options) {
      return this.map(function (model) { return model.toJSON(options); });
    },

    // Add a model, or list of models to the set.
    add: function (models, options) {
      return this.set(models, _.extend({ merge: false }, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function (models, options) {
      var singular = !_.isArray(models);
      models = singular ? [models] : _.clone(models);
      options || (options = {});
      for (var i = 0, length = models.length; i < length; i++) {
        var model = models[i] = this.get(models[i]);
        if (!model) continue;
        var id = this.modelId(model.attributes);
        if (id != null) delete this._byId[id];
        delete this._byId[model.cid];
        var index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;
        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }
        this._removeReference(model, options);
      }
      return singular ? models[0] : models;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function (models, options) {
      options = _.defaults({}, options, setOptions);
      var singular = !_.isArray(models);
      models = singular ? (models ? [models] : []) : models.slice();
      var id, model, attrs, existing, sort;
      var at = options.at;
      var sortable = this.comparator && (at == null) && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;
      var toAdd = [], toRemove = [], modelMap = {};
      var add = options.add, merge = options.merge, remove = options.remove;
      var order = !sortable && add && remove ? [] : false;

      // Turn bare objects into model references
      for (var i = 0, length = models.length; i < length; i++) {
        attrs = models[i];

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        if (existing = this.get(attrs)) {
          if (remove) modelMap[existing.cid] = true;
          if (merge && attrs !== existing) {
            attrs = this._isModel(attrs) ? attrs.attributes : attrs;
            existing.set(attrs, options);
            if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
          }
          models[i] = existing;

        // If this is a new model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(attrs, options);
          if (!model) continue;
          toAdd.push(model);
          this._addReference(model, options);
        }

        // Do not add multiple models with the same `id`.
        model = existing || model;
        if (!model) continue;
        id = this.modelId(model.attributes);
        if (order && (model.isNew() || !modelMap[id])) order.push(model);
        modelMap[id] = true;
      }

      // Remove nonexistent models if appropriate.
      if (remove) {
        for (var i = 0, length = this.length; i < length; i++) {
          if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
        }
        if (toRemove.length) this.remove(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      if (toAdd.length || (order && order.length)) {
        if (sortable) sort = true;
        this.length += toAdd.length;
        if (at != null) {
          for (var i = 0, length = toAdd.length; i < length; i++) {
            this.models.splice(at + i, 0, toAdd[i]);
          }
        } else {
          if (order) this.models.length = 0;
          var orderedModels = order || toAdd;
          for (var i = 0, length = orderedModels.length; i < length; i++) {
            this.models.push(orderedModels[i]);
          }
        }
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({ silent: true });

      // Unless silenced, it's time to fire all appropriate add/sort events.
      if (!options.silent) {
        var addOpts = at != null ? _.clone(options) : options;
        for (var i = 0, length = toAdd.length; i < length; i++) {
          if (at != null) addOpts.index = at + i;
          (model = toAdd[i]).trigger('add', model, this, addOpts);
        }
        if (sort || (order && order.length)) this.trigger('sort', this, options);
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function (models, options) {
      options || (options = {});
      for (var i = 0, length = this.models.length; i < length; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({ silent: true }, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function (model, options) {
      return this.add(model, _.extend({ at: this.length }, options));
    },

    // Remove a model from the end of the collection.
    pop: function (options) {
      var model = this.at(this.length - 1);
      this.remove(model, options);
      return model;
    },

    // Add a model to the beginning of the collection.
    unshift: function (model, options) {
      return this.add(model, _.extend({ at: 0 }, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function (options) {
      var model = this.at(0);
      this.remove(model, options);
      return model;
    },

    // Slice out a sub-array of models from the collection.
    slice: function () {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id.
    get: function (obj) {
      if (obj == null) return void 0;
      var id = this.modelId(this._isModel(obj) ? obj.attributes : obj);
      return this._byId[obj] || this._byId[id] || this._byId[obj.cid];
    },

    // Get the model at the given index.
    at: function (index) {
      if (index < 0) index += this.length;
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function (attrs, first) {
      if (_.isEmpty(attrs)) return first ? void 0 : [];
      return this[first ? 'find' : 'filter'](function (model) {
        for (var key in attrs) {
          if (attrs[key] !== model.get(key)) return false;
        }
        return true;
      });
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function (attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function (options) {
      if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      // Run sort based on type of `comparator`.
      if (_.isString(this.comparator) || this.comparator.length === 1) {
        this.models = this.sortBy(this.comparator, this);
      } else {
        this.models.sort(_.bind(this.comparator, this));
      }

      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function (attr) {
      return _.invoke(this.models, 'get', attr);
    },

    // Create a new collection with an identical list of models as this one.
    clone: function () {
      return new this.constructor(this.models, {
        model: this.model,
        comparator: this.comparator
      });
    },

    // Define how to uniquely identify models in the collection.
    modelId: function (attrs) {
      return attrs[this.model.prototype.idAttribute || 'id'];
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function () {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function (attrs, options) {
      if (this._isModel(attrs)) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }
      options = options ? _.clone(options) : {};
      options.collection = this;
      return new this.model(attrs, options);
    },

    // Method for checking whether an object should be considered a model for
    // the purposes of adding to the collection.
    _isModel: function (model) {
      return model instanceof Model;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function (model, options) {
      this._byId[model.cid] = model;
      var id = this.modelId(model.attributes);
      if (id != null) this._byId[id] = model;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function (model, options) {
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function (event, model, collection, options) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      if (event === 'change') {
        var prevId = this.modelId(model.previousAttributes());
        var id = this.modelId(model.attributes);
        if (prevId !== id) {
          if (prevId != null) delete this._byId[prevId];
          if (id != null) this._byId[id] = model;
        }
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of O_o Collections is actually implemented
  // right here:
  var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
    'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
    'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
    'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
    'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
    'lastIndexOf', 'isEmpty', 'chain', 'sample', 'partition'];

  // Mix in each Underscore method as a proxy to `Collection#models`.
  _.each(methods, function (method) {
    if (!_[method]) return;
    Collection.prototype[method] = function () {
      var args = slice.call(arguments);
      args.unshift(this.models);
      return _[method].apply(_, args);
    };
  });

  // Underscore methods that take a property name as an argument.
  var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];

  // Use attributes instead of properties.
  _.each(attributeMethods, function (method) {
    if (!_[method]) return;
    Collection.prototype[method] = function (value, context) {
      var iterator = _.isFunction(value) ? value : function (model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });

  // O_o.View
  // -------------

  // O_o Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a O_o.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = O_o.View = function(options) {
    this.cid = _.uniqueId('view');
    options || (options = {});
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
    this.delegateEvents();
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be merged as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **O_o.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"svg"`.
    tagName: 'svg',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable O_o.Events listeners.
    remove: function() {
      this.$el.remove();
      this.stopListening();
      return this;
    },

    // Change the view's element (`this.el` property), including event
    // re-delegation.
    setElement: function(element, delegate) {
      if (this.$el) this.undelegateEvents();
      this.$el = element instanceof O_o.$ ? element : O_o.$(element);
      this.el = this.$el[0];
      if (delegate !== false) this.delegateEvents();
      return this;
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    // This only works for delegate-able events: not `focus`, `blur`, and
    // not `change`, `submit`, and `reset` in Internet Explorer.
    delegateEvents: function(events) {
      if (!(events || (events = _.result(this, 'events')))) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[events[key]];
        if (!method) continue;

        var match = key.match(delegateEventSplitter);
        var eventName = match[1], selector = match[2];
        method = _.bind(method, this);
        eventName += '.delegateEvents' + this.cid;
        if (selector === '') {
          this.$el.on(eventName, method);
        } else {
          this.$el.on(eventName, selector, method);
        }
      }
      return this;
    },

    // Clears all callbacks previously bound to the view with `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // O_o views attached to the same DOM element.
    undelegateEvents: function() {
      this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        var $el;
        if (_.include(svg_tags, _.result(this, 'tagName'))) {
          $el = O_o.$(document.createElementNS('http://www.w3.org/2000/svg', _.result(this, 'tagName'))).attr(attrs);
        } else {
          $el = O_o.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
        }
        this.setElement($el, false);
      } else {
        this.setElement(_.result(this, 'el'), false);
      }
    }

  });

  // Store a collection of all charts created
  var all_charts = [];

  // O_o.Chart
  // -------------------

  // Datasets must contian labels with values at the very minimum span the set
  // of possible x values.  Dataset must be composed of ordered functional
  // values, meaning that x values must increase with each datum.

  var Chart = O_o.Chart = function (data, options) {
    all_charts.push(this);
    this.cid = _.uniqueId('view');
    options || (options = {});
    if (options.globalOptions) _.extend(globalOptions, options.globalOptions);
    _.extend(this, _.pick(options, chartOptions));
    this._ensureElement();
    this._attachToContainer();
    this._reset();
    this.initialize.apply(this, arguments);
    this.listenTo(O_o, 'shrink', this._shrink);
    this.listenTo(O_o, 'grow', this._grow);
    this.listenTo(O_o, 'set_size', this._setSize);
    this.listenTo(O_o, 'calculate_label_dimensions', this._calculateLabelDimensions);
    this.listenTo(O_o, 'set_canvas', this._setCanvas);
    this.listenTo(O_o, 'calculate_axes', this._calculateAxes);
    this.listenTo(O_o, 'set_axes', this._setAxes);
    this.listenTo(O_o, 'set_point_thresholds', this._setPointThresholds);
    if (data) this._setup(data, _.extend({ silent: true }, options));
    this.delegateEvents();
    this.renderLegend();

    // This is overkill if there are multiple charts. It would be better to only
    // do this once after all charts have been added.
    O_o.trigger('shrink');
    O_o.trigger('grow');
    O_o.trigger('set_size');
    O_o.trigger('calculate_label_dimensions'); // best guess at size
    O_o.trigger('set_canvas');
    O_o.trigger('calculate_axes');
    O_o.trigger('calculate_label_dimensions'); // reset after y-axis is known
    O_o.trigger('set_canvas');
    O_o.trigger('set_axes');
    O_o.trigger('set_point_thresholds');
    O_o.trigger('render');

    this.render();
  };

  // List of chart options to be merged as properties.
  var chartOptions = [
    'container', 'el', 'id', 'attributes', 'className', 'tagName', 'events',
    'type', 'aspect_ratio', 'grid_stroke_color', 'grid_stroke_width',
    'grid_show_lines', 'axes_stroke_color', 'axes_stroke_width',
    'axes_font_family', 'axes_font_size', 'axes_font_color',
    'x_axis_lower_bound_zero', 'y_axis_lower_bound_zero', 'point_radius',
    'point_stroke_width', 'line_stroke_width', 'bar_stroke_width',
    'bar_spacing', 'tooltip_offset', 'tooltip_font_family',
    'tooltip_font_color', 'tooltip_font_size', 'tooltip_font_weight',
    'tooltip_letter_spacing', 'legend_font_family', 'legend_font_color',
    'legend_font_size'
  ];

  _.extend(Chart.prototype, View.prototype, {
    container: 'body',

    events: {
      'mousemove': '_triggerMousemove',
      'mouseleave': '_triggerMouseleave'
    },

    _triggerMousemove: function (event) {
      var offset = this.$el.offset();
      this.trigger('mousemove', {
        x: event.pageX - offset.left,
        y: event.pageY - offset.top
      });
    },

    _triggerMouseleave: function (event) {
      this.trigger('mouseleave');
    },

    _attachToContainer: function () {
      this.$container = $(this.container);
      this.$chart_container = $('<div>', { class: 'disapproval-chart-container' });
      $(this.container).append(this.$chart_container.append(this.$el));
    },

    _reset: function () {
      if (this.datasets) _.each(this.datasets, function (dataset) {
        dataset.set([]); // TODO: fix this hack, see PointView
        dataset.remove();
      });
      this.datasets = [];
      this.data_range = { x_min: Infinity, x_max: -Infinity, y_min: Infinity, y_max: -Infinity };
      this.canvas = {
        left: { width: 0, height: 0, offset: { x: 0, y: 0 }},
        bottom: { width: 0, height: 0, offset: { x: 0, y: 0 }},
        main: { width: 0, height: 0, offset: { x: 0, y: 0 }}
      };
      if (this.tooltipCollection) {
        this.tooltipCollection.set([]); // it's important to remove any stray tooltip items
      } else {
        this.tooltipCollection = new O_o.Collection([], { comparator: function (model) { return -model.get('y'); } });
        this.tooltipCollection.chart = this;
      }
    },

    _setBounds: function () {
      // TODO: this could be optimized, especially for equally spaced x data between datasets
      _.each(this.datasets, function (dataset) {
        var x_min = _.min(dataset.pluck('x'));
        var x_max = _.max(dataset.pluck('x'));
        var y_min = _.min(dataset.pluck('y'));
        var y_max = _.max(dataset.pluck('y'));
        if ( x_min < this.data_range.x_min) this.data_range.x_min = x_min;
        if ( x_max > this.data_range.x_max) this.data_range.x_max = x_max;
        if ( y_min < this.data_range.y_min) this.data_range.y_min = y_min;
        if ( y_max > this.data_range.y_max) this.data_range.y_max = y_max;

        if (this.data_range.y_min > 0 && this.y_axis_lower_bound_zero) {
          this.data_range.y_min = 0;
        }
        if (this.data_range.x_min > 0 && this.x_axis_lower_bound_zero) {
          this.data_range.x_min = 0;
        }
      }, this);

      var natural_y_bounds = this._naturalBoundsY();
      var natural_x_bounds = this._naturalBoundsX();
      this.bounds = {
        y_min: natural_y_bounds.min,
        y_max: natural_y_bounds.max,
        y_step: natural_y_bounds.step,
        x_min: natural_x_bounds.min,
        x_max: natural_x_bounds.max,
        x_step: natural_x_bounds.step
      }
    },

    _naturalBoundsY: function () {
      var range = this.data_range.y_max - this.data_range.y_min;

      // Determine the steps in divisions of the relevant power of 10.
      // e.g division of 0 0.25 0.5 0.75 are natural for data bounded by 1
      // and divisions of 0 2.5 5 7.5 are natural for data bounded by 10
      var step = Math.pow(10, String(Math.floor(range)).length - 1);
      if (range > 0) {
        while (range / step < 11) {
          step /= 2;
        }
      }
      var lower_bound;
      if (this.data_range.y_min >= 0 && this.data_range.y_min < step) {
        lower_bound = 0;
      } else {
        lower_bound = Math.floor(this.data_range.y_min / step) * step;
      }

      var upper_bound = Math.ceil(this.data_range.y_max / step) * step + step / 2;
      return { min: lower_bound, max: upper_bound, step: step };
    },

    _naturalBoundsX: function () {
      var lower_bound;
      var upper_bound;
      var total_steps;
      var step;
      var chart_padding;

      if (this.type == 'bar') {
        lower_bound = this.data_range.x_min
        upper_bound = this.data_range.x_max
        total_steps = this.datasets[0].length - 1;
        if (total_steps == 0) {
          step = 1;
        } else {
          step = (upper_bound - lower_bound) / (total_steps);
        }
        chart_padding = step * 3 / 4;
        return { min: lower_bound - chart_padding, max: upper_bound + chart_padding, step: step };
      }

      var label_min = _.max(_.filter(this.labels, function (label) { return label.x <= this.data_range.x_min; }, this), function (label) { return label.x });
      var label_max = _.min(_.filter(this.labels, function (label) { return label.x >= this.data_range.x_max; }, this), function (label) { return label.x });

      var labels = _.reject(this.labels, function (label) {
        return (label.x < label_min.x || label.x > label_max.x);
      });

      total_steps = labels.length - 1;
      if (total_steps == 0) {
        step = 1;
        chart_padding = step * 3 / 4;
        return { min: label_min.x - chart_padding, max: label_max.x + chart_padding, step: step };
      } else {
        step = (label_max.x - label_min.x) / (total_steps)
      }

      if (this.data_range.x_min >= 0 && this.data_range.x_min < step) {
        lower_bound = 0;
      } else {
        lower_bound = label_min.x;
      }

      if (globalOptions.multiple_charts_align_right_point) {
        // NOTE: This approach only works if the left axes are also aligned
        // otherwise the right points will be off by 4% of the difference
        // of the label widths.
        // TODO: take differences in main canvas size into account so that the
        // right points will align without the left axes being aligned
        upper_bound = lower_bound + (this.data_range.x_max - lower_bound) * 1.04;
      } else if (label_max.x - step == this.data_range.x_max) {
        upper_bound = this.data_range.x_max + step / 2;
      } else {
        upper_bound = label_max.x + step / 2;
      }
      return { min: lower_bound, max: upper_bound, step: step };
    },

    _calculateAxes: function () {
      var padding = 7;

      // y-axis
      var y_step = this.bounds.y_step;
      while ((this.canvas.left.label.height + padding) * _.range(this.bounds.y_min, this.bounds.y_max, y_step).length > this.canvas.left.height) {
        y_step *= 2;
      }
      var y_values = _.map(_.range(this.bounds.y_min, this.bounds.y_max, y_step), function (y) {
        return {
          y: y,
          label: String(y) // TODO: format as desired
        };
      }, this);
      if (!this.y_axis) {
        this.y_axis = new O_o.Collection();
        this.y_axis.chart = this;
      }
      this.y_axis.new_values = y_values;

      // x-axis
      if (this.type == 'bar' && this.labels.length == 0) {
        this.labels = _.map(_.range(this.data_range.x_min, this.data_range.x_max + this.bounds.x_step, this.bounds.x_step), function (x) {
          return { x: x, label: '' }
        });
      }

      var labels = _.reject(this.labels, function (label) {
        return (label.x < this.bounds.x_min || label.x > this.bounds.x_max)
      }, this);
      while ((this.canvas.bottom.label.height + padding) * labels.length + this.canvas.bottom.label.width > this.canvas.bottom.width) {
        if (labels.length <= 2) break; // break if the label width is wider than the chart
        labels = _.select(labels, function (x, i) { return i % 2 == 0; });
      }

      if (!this.x_axis) {
        this.x_axis = new O_o.Collection();
        this.x_axis.chart = this;
      }
      this.x_axis.new_values = labels;
    },

    _setAxes: function () {
      if (globalOptions.multiple_charts_align_left_axes) {
        var max_left_label_width = _.max(_.map(all_charts, function (chart) {
          return chart.canvas.left.label.width;
        }));
        if (this.canvas.left.label.width < max_left_label_width) this.canvas.left.label.width = max_left_label_width;
        this._setCanvas();
      }
      if (globalOptions.multiple_charts_align_right_point) {
        // TODO: corresponding to the note above, in order to do this more correctly,
        // the differences in the widths of the main canvas should be taken into account
        var min_total_canvas_width = _.min(_.map(all_charts, function (chart) {
          return chart.canvas.main.width + chart.canvas.left.width;
        }));
        if (this.canvas.main.width + this.canvas.left.width > min_total_canvas_width) {
          this.canvas.bottom.width = this.canvas.main.width = min_total_canvas_width - this.canvas.left.width;
          this._setCanvasHeights();
        }
      }

      this.y_axis.set(this.y_axis.new_values);
      this.x_axis.set(this.x_axis.new_values);
    },

    _setPointThresholds: function () {
      _.each(this.datasets, function (dataset) {
        dataset.each(function (point, i) {
          if (dataset.models[i + 1]) {
            var threshold = this.xConversion(dataset.models[i + 1].get('x') - point.get('x')) / 2;
            point.set('threshold_right', threshold);
            if (i == 0) {
              point.set('threshold_left', this.xConversion(this.bounds.x_step / 2)); // an arbitrary choice
            }
            dataset.models[i + 1].set('threshold_left', threshold);
          } else if (dataset.length == 1) {
            point.set('threshold_left', this.xConversion(this.bounds.x_step / 2)); // corresponds to step default for one data point
            point.set('threshold_right', this.xConversion(this.bounds.x_step / 2)); // corresponds to step default for one data point
          } else {
            point.set('threshold_right', this.xConversion(this.bounds.x_step / 2)); // an arbitrary choice
          }
        }, this);
      }, this);
    },

    _shrink: function () {
      this.$el.attr({ width: 0, height: 0 });
    },

    _grow: function () {
      // set best guess at height of container
      this.$chart_container.height(Math.round(this.$chart_container.width() / this.aspect_ratio));
    },

    _setSize: function () {
      // reset height with updated width from the potential addition of a scrollbar
      this.$chart_container.height(Math.round(this.$chart_container.width() / this.aspect_ratio));
      // grab accurate dimensions
      this.width = this.$chart_container.width();
      this.height = this.$chart_container.height();
      this.$el.attr({
        width: this.width,
        height: this.height
      });
    },

    _calculateLabelDimensions: function() {
      this._calculateYLabel();
      this._calculateXLabels();
    },

    _calculateYLabel: function () {
      var label_text;
      if (this.y_axis && this.y_axis.new_values) {
        // calculate the widest text label
        // perferring highest value will choose the widest rendered string
        // e.g. 1000 is wider than 87.5
        var max_length = 0;
        _.each(this.y_axis.new_values, function (value) {
          if (value.label.length >= max_length) {
            max_length = value.label.length;
            label_text = value.label;
          }
        });
      } else {
        label_text = String(this.bounds.y_max); // TODO: Change from String to the correct function if labels are formatted
      }

      // create svg text element and to append it to the DOM in order to get width
      var label = svg$el('text').html(label_text).attr({
        'font-family': this.axes_font_family,
        'font-size': this.axes_font_size
      });
      var temp_svg = svg$el('svg').css('visibility', 'hidden');
      $('body').append(temp_svg);
      temp_svg.append(label);
      this.canvas.left.label = {
        width: label.width(),
        height: this.axes_font_size
      }
      temp_svg.remove();
    },

    _calculateXLabels: function () {
      this.canvas.bottom.label = {
        width: 0,
        height: this.axes_font_size
      };

      var temp_svg = svg$el('svg').css('visibility', 'hidden');
      $('body').append(temp_svg);
      _.each(this.labels, function (label) {
        label = svg$el('text').html(label.label).attr({
          'font-family': this.axes_font_family,
          'font-size': this.axes_font_size
        });
        temp_svg.append(label);
        var width = label.width();
        if (width > this.canvas.bottom.label.width) this.canvas.bottom.label.width = width;
      }, this);
      temp_svg.remove();
    },

    _setCanvas: function () {
      this._setCanvasWidths();
      this._setCanvasHeights();
      if (this.canvas.bottom.label.is_tilted) {
        this._alterCanvasWidthsForTiltedLabels();
      }
    },

    _setCanvasWidths: function () {
      var padding = 10;
      var width = this.canvas.left.label.width + padding;
      this.canvas.left.width = this.canvas.bottom.offset.x = this.canvas.main.offset.x = width;
      this.canvas.bottom.width = this.canvas.main.width = this.width - width;
    },

    _setCanvasHeights: function () {
      var padding = 10;

      var label_width = this.canvas.bottom.label.width;
      var max_available_label_space = this.canvas.bottom.width / _.range(this.bounds.x_min, this.bounds.x_max, this.bounds.x_step).length;
      var first_x_tick_x_offset = this.xScale(this.data_range.x_min) + this.canvas.main.offset.x;

      var height;
      if (label_width > max_available_label_space || label_width / 2 > first_x_tick_x_offset) {
        height = this.canvas.bottom.label.width / Math.sqrt(2) + 2 * padding;
        this.canvas.bottom.label.is_tilted = true;
      } else {
        height = this.canvas.bottom.label.height + 2 * padding;
        this.canvas.bottom.label.is_tilted = false;
      }
      this.canvas.bottom.height = height;
      this.canvas.left.height = this.canvas.main.height = this.canvas.bottom.offset.y = this.height - height;
    },
    
    _alterCanvasWidthsForTiltedLabels: function () {
      this.canvas.bottom.width = this.canvas.main.width = this.canvas.bottom.width - this.canvas.bottom.label.width / Math.sqrt(2);
    },

    // also remove this from the collection of all charts when a chart is removed
    remove: function () {
      all_charts = _.without(all_charts, this);
      O_o.View.prototype.remove.call(this);
    },

    // public methods
    reset: function (data, options) {
      this._setup(data, options);

      if (this.datasets.length == 1) {
        this.legendView.$el.hide();
      } else {
        this.legendView.$el.show();
      }

      this.trigger('render_legend');

      O_o.trigger('shrink');
      O_o.trigger('grow');
      O_o.trigger('set_size');
      O_o.trigger('calculate_label_dimensions'); // best guess at size
      O_o.trigger('set_canvas');
      O_o.trigger('calculate_axes');
      O_o.trigger('calculate_label_dimensions'); // reset after y-axis is known
      O_o.trigger('set_canvas');
      O_o.trigger('set_axes');
      O_o.trigger('set_point_thresholds');
      O_o.trigger('render');

      this.trigger('render')

      return this;
    },

    // public methods
    _setup: function (data, options) {
      options || (options = {});
      this._reset();
      this.labels = data.labels;
      var color_palette = data.datasets.length > 10 ? color_palette_20 : color_palette_10;
      this.datasets = _.map(data.datasets, function (dataset, i) {
        var points = _.map(dataset.x, function (x, j) {
          return {
            x: dataset.x[j],
            y: dataset.y[j],
            meta: dataset.meta[j]
          };
        });
        var dataset_collection = new O_o.Collection(points);
        dataset_collection.name = dataset.name;
        dataset_collection.color = chartColoring(i, color_palette);
        dataset_collection.chart = this;
        return dataset_collection;
      }, this);
      if (this.cached_type == 'bar') this.type = 'bar';
      if (this.cached_y_axis_lower_bound_zero == false) this.y_axis_lower_bound_zero = false;
      if (this.type == 'bar') {
        if (this.datasets.length > 1) {
          // bar charts are for one dataset only
          this.cached_type = 'bar';
          this.type = 'line';
        } else {
          // bar charts should begin at y = 0
          this.cached_y_axis_lower_bound_zero = this.y_axis_lower_bound_zero;
          this.y_axis_lower_bound_zero = true;
        }
      }
      this.max_points = _.max(_.map(this.datasets, function (dataset) { return dataset.length; }));
      this._setBounds();
      if (!options.silent) this.trigger('reset', this, options);
      return this;
    },

    xScale: function (x) {
      return this.xConversion(x - this.bounds.x_min);
    },

    xConversion: function (x) {
      return x * this.canvas.main.width / (this.bounds.x_max - this.bounds.x_min);
    },

    yScale: function (y) {
      return this.canvas.main.height - this.yConversion(y - this.bounds.y_min);
    },

    yConversion: function (y) {
      return y * this.canvas.main.height / (this.bounds.y_max - this.bounds.y_min);
    },

    // TODO: delete these
    // inverseXScale: function (x) {
    //   return x * (this.bounds.x_max - this.bounds.x_min) / this.canvas.main.width + this.bounds.x_min;
    // },

    // inverseYScale: function (y) {
    //   return (1 - y / this.canvas.main.height) * (this.bounds.y_max - this.bounds.y_min) + this.bounds.y_min;
    // },

    renderLegend: function () {
      this.legendView = new LegendView({ model: this });
      if (this.datasets.length == 1) this.legendView.$el.hide();
      this.$container.append(this.legendView.$el);
      this.legendView._applyCss(); // The view needs to be appended before determining overflow.  TODO: clean this up.
    },

    render: function () {
      this.$el.append(new LeftView({ model: this }).$el);
      this.$el.append(new BottomView({ model: this }).$el);
      this.$el.append(new MainView({ model: this }).$el);
      this.tooltipCollection.$container = $('<div>', { class: 'tooltip container' }).css({
        position: 'absolute',
        'border-radius': 3,
        'background-color': 'rgba(0,0,0,0.8)',
        '-webkit-box-shadow': '0px 1px 2px rgba(0,0,0,0.2)',
        '-moz-box-shadow': '0px 1px 2px rgba(0,0,0,0.2)',
        'box-shadow': '0px 1px 2px rgba(0,0,0,0.2)'
      }).hide();
      $('body').append(this.tooltipCollection.$container.append(new TooltipView({ collection: this.tooltipCollection }).$el));
    },

    initialize: function () {},

    type: 'bar',

    aspect_ratio: 16 / 9,

    grid_stroke_color: "rgba(0,0,0,0.06)",
    grid_stroke_width: 1,
    grid_show_lines: true,

    axes_stroke_color: "rgba(0,0,0,0.15)",
    axes_stroke_width: 1,
    axes_font_family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
    axes_font_size: 12,
    axes_font_color: "rgba(0,0,0,0.7)",
    x_axis_lower_bound_zero: false,
    y_axis_lower_bound_zero: false,

    point_radius: 3.8,
    point_stroke_width: 1.2,

    line_stroke_width: 2,

    bar_stroke_width: 2,
    bar_spacing: 0.1,

    tooltip_offset: 10,
    tooltip_font_family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
    tooltip_font_color: "rgba(255,255,255,1)",
    tooltip_font_size: 15,
    tooltip_font_weight: 'lighter',
    tooltip_letter_spacing: 1.8,

    legend_font_family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
    legend_font_color: "rgba(0,0,0,0.7)",
    legend_font_size: 15
  });






  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function (protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function () { return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    var Surrogate = function () { this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection.
  Model.extend = Collection.extend = View.extend = Chart.extend = extend;

  $(window).resize(_.debounce(function () {
    // Do not change this willy-nilly
    O_o.trigger('shrink');
    O_o.trigger('grow');
    O_o.trigger('set_size');
    O_o.trigger('calculate_label_dimensions'); // best guess at size
    O_o.trigger('set_canvas');
    O_o.trigger('calculate_axes');
    O_o.trigger('calculate_label_dimensions'); // reset after y-axis is known
    O_o.trigger('set_canvas');
    O_o.trigger('set_axes');
    O_o.trigger('set_point_thresholds');
    O_o.trigger('render');
  }, 300));

  // Define which tag are svg namespaced
  // NOTE: this approch isn't general because some of the tag names overlap.
  // We just happen to not use any overlapping names is this app.
  var svg_tags = [
    'circle',
    'line',
    'polyline',
    'rect',
    'svg',
    'text'
  ];

  var color_palette_10 = [
    '151,187,205',
    '255,127,14',
    '44,160,44',
    '214,39,40',
    '148,103,189',
    '140,86,75',
    '227,119,194',
    '127,127,127',
    '188,189,34',
    '23,190,207'
  ];

  var color_palette_20 = [
    '151,187,205',
    '31,119,180',
    '255,127,14',
    '255,187,120',
    '44,160,44',
    '152,223,138',
    '214,39,40',
    '255,152,150',
    '148,103,189',
    '197,176,213',
    '140,86,75',
    '196,156,148',
    '227,119,194',
    '247,182,210',
    '127,127,127',
    '199,199,199',
    '188,189,34',
    '219,219,141',
    '23,190,207',
    '158,218,229'
  ];

  var globalOptions = {
    multiple_charts_align_left_axes: false,
    multiple_charts_align_right_point: false
  };

  function chartColoring(i, color_palette) {
    i = i % color_palette.length;
    return {
      lineStrokeColor: 'rgba(' + color_palette[i] + ',1)',
      pointColor: 'rgba(' + color_palette[i] + ',1)',
      pointStrokeColor: "#fff",
      pointHighlightFill: "#fff",
      pointHighlightStroke: 'rgba(' + color_palette[i] + ',1)',
      barFillColor: 'rgba(' + color_palette[i] + ',0.75)',
      barStrokeColor: 'rgba(' + color_palette[i] + ',0.85)',
      barHighlightFill: 'rgba(' + color_palette[i] + ',0.95)',
      barHighlightStroke: 'rgba(' + color_palette[i] + ',1)'
    };
  }

  function svg$el(tag_name, attributes) {
    attributes || (attributes = {});
    return O_o.$(document.createElementNS('http://www.w3.org/2000/svg', tag_name)).attr(attributes);
  }

  // LeftView 
  // -------------------

  // A view extention for rendering the y-axis and labels

  var LeftView = O_o.View.extend({
    className: 'canvas-left',

    initialize: function () {
      this.listenTo(this.model.y_axis, 'add', this.renderYTick);
      this.render();
    },

    render: function () {
      this.renderYLine();
      this.model.y_axis.each( function (model) {
        this.renderYTick(model);
      }, this);
    },

    renderYLine: function () {
      this.$el.append(new YLineView({ collection: this.model.x_axis }).$el);
    },

    renderYTick: function (model) {
      this.$el.append(new YTickView({ model: model }).$el);
      this.$el.append(new YLabelView({ model: model }).$el);
      if (this.model.grid_show_lines) {
        if (model.get('y') != this.model.bounds.y_min) {
          this.$el.append(new YGridView({ model: model }).$el);
        }
      }
    }
  });

  var YLineView = O_o.View.extend({
    tagName: 'line',

    initialize: function () {
      this.chart = this.collection.chart;
      this.listenTo(this.collection, 'sort', this.render); // sort fires when collect set is finshed
      this.render();
    },

    render: function () {
      this.$el.attr({
        x1: this.chart.canvas.left.width,
        x2: this.chart.canvas.left.width,
        y1: this.chart.canvas.left.offset.y,
        y2: this.chart.canvas.left.offset.y + this.chart.canvas.left.height,
        stroke: this.chart.axes_stroke_color,
        'stroke-width': this.chart.axes_stroke_width,
        'shape-rendering': 'crispEdges'
      });
    }
  });


  var YTickView = O_o.View.extend({
    tagName: 'line',

    initialize: function () {
      this.chart = this.model.collection.chart;
      this.listenTo(this.model, 'remove', this.remove);
      this.render();
    },

    render: function () {
      var tick_width = 5;
      var position = this.chart.yScale(this.model.get('y'));
      this.$el.attr({
        x1: this.chart.canvas.left.width - tick_width,
        x2: this.chart.canvas.left.width,
        y1: position,
        y2: position,
        stroke: this.chart.axes_stroke_color,
        'stroke-width': this.chart.axes_stroke_width,
        'shape-rendering': 'crispEdges'
      });
    }
  });

  var YLabelView = O_o.View.extend({
    tagName: 'text',

    initialize: function () {
      this.chart = this.model.collection.chart;
      this.listenTo(this.model, 'remove', this.remove);
      this.render();
    },

    render: function () {
      var position = this.chart.yScale(this.model.get('y'));

      this.$el.html(this.model.get('label'));
      this.$el.attr({
        fill: this.chart.axes_font_color,
        'font-family': this.chart.axes_font_family,
        'font-size': this.chart.axes_font_size
      });

      var temp_svg = svg$el('svg').css('visibility', 'hidden');
      temp_svg.append(this.$el);
      $('body').append(temp_svg);
      var width = this.$el.width();
      temp_svg.remove();

      var label_margin_right = 10;
      this.$el.attr({
        x: this.chart.canvas.left.width - width - label_margin_right,
        y: position + this.chart.axes_font_size / 2 - 1 // Don't know why we need a 1 here, maybe lineheight of tick
      });

    }
  });

  var YGridView = O_o.View.extend({
    tagName: 'line',

    initialize: function () {
      this.chart = this.model.collection.chart;
      this.listenTo(this.model, 'remove', this.remove);
      this.render();
    },

    render: function () {
      var position = this.chart.yScale(this.model.get('y'));
      this.$el.attr({
        x1: this.chart.canvas.main.offset.x,
        x2: this.chart.canvas.main.offset.x + this.chart.canvas.main.width,
        y1: position,
        y2: position,
        stroke: this.chart.grid_stroke_color,
        'stroke-width': this.chart.grid_stroke_width,
        'shape-rendering': 'crispEdges'
      });
    }
  });

  var BottomView = O_o.View.extend({
    className: 'canvas-bottom',

    initialize: function () {
      this.listenTo(this.model.x_axis, 'add', this.renderXTick);
      this.render();
    },

    render: function () {
      this.$el.append(new XLineView({ collection: this.model.x_axis }).$el);
      this.model.x_axis.each(function (model) {
        this.renderXTick(model);
      }, this);
    },

    renderXTick: function (model) {
      if (this.model.type != 'bar') {
        this.$el.append(new XTickView({ model: model }).$el);
      }
      this.$el.append(new XLabelView({ model: model }).$el);
      if (this.model.grid_show_lines) {
        if (model.get('x') != this.model.bounds.x_min) {
          this.$el.append(new XGridView({ model: model }).$el);
        }
      }
    }

  });

  var XLineView = O_o.View.extend({
    tagName: 'line',

    initialize: function () {
      this.chart = this.collection.chart;
      this.listenTo(this.collection, 'sort', this.render); // sort fires when collect set is finshed
      this.render();
    },

    render: function () {
      this.$el.attr({
        x1: this.chart.canvas.bottom.offset.x,
        x2: this.chart.canvas.bottom.offset.x + this.chart.canvas.bottom.width,
        y1: this.chart.canvas.bottom.offset.y,
        y2: this.chart.canvas.bottom.offset.y,
        stroke: this.chart.axes_stroke_color,
        'stroke-width': this.chart.axes_stroke_width,
        'shape-rendering': 'crispEdges'
      });
    }
  });

  var XTickView = O_o.View.extend({
    tagName: 'line',

    initialize: function () {
      this.chart = this.model.collection.chart;
      this.listenTo(this.model, 'remove', this.remove);
      this.render();
    },

    render: function () {
      var tick_width = 5;
      var position = this.chart.xScale(this.model.get('x'));
      this.$el.attr({
        x1: position + this.chart.canvas.bottom.offset.x,
        x2: position + this.chart.canvas.bottom.offset.x,
        y1: this.chart.canvas.bottom.offset.y + tick_width,
        y2: this.chart.canvas.bottom.offset.y,
        stroke: this.chart.axes_stroke_color,
        'stroke-width': this.chart.axes_stroke_width,
        'shape-rendering': 'crispEdges'
      });
    }
  });

  var XLabelView = O_o.View.extend({
    tagName: 'text',

    initialize: function () {
      this.chart = this.model.collection.chart;
      this.listenTo(this.model, 'remove', this.remove);
      this.render();
    },

    render: function () {
      var position = this.chart.xScale(this.model.get('x'));

      this.$el.html(this.model.get('label'));
      this.$el.attr({
        fill: this.chart.axes_font_color,
        'font-family': this.chart.axes_font_family,
        'font-size': this.chart.axes_font_size
      });

      var temp_svg = svg$el('svg').css('visibility', 'hidden');
      temp_svg.append(this.$el);
      $('body').append(temp_svg);
      var width = this.$el.width();
      temp_svg.remove();

      var label_margin_top = 8;
      var tilted_label_margin_top = 2;
      var y = this.chart.canvas.bottom.offset.y + this.chart.axes_font_size;
      var x = position + this.chart.canvas.bottom.offset.x;
      if (this.chart.canvas.bottom.label.is_tilted) {
        this.$el.attr({
          x: x,
          y: y + tilted_label_margin_top,
          transform: 'rotate(45 ' + x + ',' + y + ')'
        });
      } else {
        this.$el.attr({
          x: x - width / 2,
          y: y + label_margin_top
        });
      }
    }
  });

  var XGridView = O_o.View.extend({
    tagName: 'line',

    initialize: function () {
      this.chart = this.model.collection.chart;
      this.listenTo(this.model, 'remove', this.remove);
      this.render();
    },

    render: function () {
      var position = this.chart.xScale(this.model.get('x'));
      this.$el.attr({
        x1: position + this.chart.canvas.main.offset.x,
        x2: position + this.chart.canvas.main.offset.x,
        y1: this.chart.canvas.main.offset.y + this.chart.canvas.main.height,
        y2: this.chart.canvas.main.offset.y,
        stroke: this.chart.grid_stroke_color,
        'stroke-width': this.chart.grid_stroke_width,
        'shape-rendering': 'crispEdges'
      });
    }
  });


  // MainView
  // -------------------

  // A view extention for rendering the main section of the chart

  var MainView = O_o.View.extend({
    className: 'canvas-main',

    initialize: function () {
      this.render();
      this.listenTo(this.model, 'render', this.render)
    },

    render: function () {
      _.each(this.model.datasets, function (dataset) {

        if (this.model.type == 'line') {
          var line_view = new LineView({
            collection: dataset
          });

          this.$el.append(line_view.$el);

          dataset.each(function (point) {
            var point_view = new PointView({
              model: point,
              collection: dataset
            });

            this.$el.append(point_view.$el);
          }, this);
        } else if (this.model.type == 'bar') {
          dataset.each(function (bar) {
            var bar_view = new BarView({
              model: bar,
              collection: dataset
            });

            this.$el.append(bar_view.$el);
          }, this);
        }
      }, this);
    }
  });

  // LineView
  // -------------------

  // A view extention for rendering polylines

  var LineView = O_o.View.extend({
    tagName: 'polyline',

    initialize: function () {
      this.chart = this.collection.chart;
      this.listenTo(O_o, 'render', this.render);
      this.listenTo(this.collection, 'remove', this.remove);
      this.render();
    },

    render: function () {
      var points = this.collection.map(function (point) {
        var x = this.chart.xScale(point.get('x')) + this.chart.canvas.main.offset.x;
        var y = this.chart.yScale(point.get('y')) + this.chart.canvas.main.offset.y;
        return x + ' ' + y
      }, this).join(',');

      this.$el.attr({
        points: points,
        stroke: this.collection.color.lineStrokeColor,
        fill: 'transparent',
        'stroke-width': this.chart.line_stroke_width
      });
    }
  });

  // PointView
  // -------------------

  // A view extention for rendering points

  var PointView = O_o.View.extend({
    tagName: 'circle',

    initialize: function () {
      this.chart = this.collection.chart;
      this.listenTo(O_o, 'render', this.render);
      this.listenTo(this.chart, 'mousemove', this.checkProximity);
      this.listenTo(this.chart, 'mouseleave', this.removeHighlightAndTooltip);
      this.listenTo(this.collection, 'highlight', this.highlight);
      this.listenTo(this.collection, 'remove_highlight', this.removeHighlight);

      // TODO: This needs to be cleaned up.  The model belongs to the dataset collection
      // and to the tooltip collection at times, so listening to the model remove event will
      // cause this view to be removed when the model is removed from the tooltip collection.
      // Listening to the dataset collection event is a hack that needs fixing.
      this.listenTo(this.collection, 'remove', this.remove);
      this.render();
    },

    render: function () {
      var x = this.chart.xScale(this.model.get('x')) + this.chart.canvas.main.offset.x;
      var y = this.chart.yScale(this.model.get('y')) + this.chart.canvas.main.offset.y;
      this.$el.attr({
        cx: x,
        cy: y,
        r: this.chart.point_radius,
        'stroke-width': this.chart.point_stroke_width
      });
      this.style();
    },

    checkProximity: function (event) {
      var delta_x = event.x - this.chart.xScale(this.model.get('x')) - this.chart.canvas.main.offset.x;
      var threshold = (delta_x < 0 ? this.model.get('threshold_left') : this.model.get('threshold_right'));
      if (Math.abs(delta_x) < this.chart.xScale(0.5)) {
        if (!this.is_highlighted) {
          this.highlight();
          this.chart.tooltipCollection.add(this.model);
        }
      } else if (this.is_highlighted) {
        this.removeHighlight();
        this.chart.tooltipCollection.remove(this.model);
      }
    },

    removeHighlightAndTooltip: function () {
      this.removeHighlight(event);
      this.chart.tooltipCollection.remove(this.model);
    },

    removeHighlight: function () {
      this.style();
      this.is_highlighted = false;
    },

    style: function () {
      this.$el.attr({
        fill: this.collection.color.pointColor,
        stroke: this.collection.color.pointStrokeColor
      });
    },

    highlight: function () {
      this.$el.attr({
        fill: this.collection.color.pointHighlightFill,
        stroke: this.collection.color.pointHighlightStroke
      });
      this.is_highlighted = true;
    }
  });


  // BarView
  // -------------------

  // A view extention for rendering bars

  var BarView = O_o.View.extend({
    tagName: 'rect',

    initialize: function () {
      this.chart = this.collection.chart;
      this.listenTo(O_o, 'render', this.render);
      this.listenTo(this.chart, 'mousemove', this.checkProximity);
      this.listenTo(this.chart, 'mouseleave', this.removeHighlightAndTooltip);
      this.listenTo(this.collection, 'highlight', this.highlight);
      this.listenTo(this.collection, 'remove_highlight', this.removeHighlight);

      // TODO: clean this up, see PointView
      this.listenTo(this.collection, 'remove', this.remove);
      this.render();
    },

    render: function () {
      var width = this.chart.xConversion(this.chart.bounds.x_step) * (1 - this.chart.bar_spacing) - this.chart.bar_stroke_width;
      var height = this.chart.yConversion(this.model.get('y'));
      var x = this.chart.xScale(this.model.get('x')) + this.chart.canvas.main.offset.x - width / 2;
      var y = this.chart.yScale(this.model.get('y')) + this.chart.canvas.main.offset.y;

      // pad bars of zero height so they display
      if (height == 0) {
        height = 1;
        y -= 1;
      }

      this.$el.attr({
        x: x,
        y: y,
        width: width,
        height: height,
        'stroke-width': this.chart.bar_stroke_width,
        'shape-rendering': 'crispEdges'
      });
      this.style();
    },

    checkProximity: function (event) {
      var delta_x = event.x - this.chart.xScale(this.model.get('x')) - this.chart.canvas.main.offset.x;
      var threshold = (delta_x < 0 ? this.model.get('threshold_left') : this.model.get('threshold_right'));
      if (Math.abs(delta_x) < Math.abs(threshold)) {
        if (!this.is_highlighted) {
          this.highlight();
          this.chart.tooltipCollection.add(this.model);
        }
      } else if (this.is_highlighted) {
        this.removeHighlight();
        this.chart.tooltipCollection.remove(this.model);
      }
    },

    removeHighlightAndTooltip: function () {
      this.removeHighlight(event);
      this.chart.tooltipCollection.remove(this.model);
    },

    removeHighlight: function () {
      this.style();
      this.is_highlighted = false;
    },

    style: function () {
      this.$el.attr({
        fill: this.collection.color.barFillColor,
        stroke: this.collection.color.barStrokeColor
      });
    },

    highlight: function () {
      this.$el.attr({
        fill: this.collection.color.barHighlightFill,
        stroke: this.collection.color.barHighlightStroke
      });
      this.is_highlighted = true;
    }
  });


  // TooltipView
  // -------------------

  // A view extention for rendering tooltips

  var TooltipView = O_o.View.extend({
    tagName: 'ul',
    className: 'tooltip list',

    initialize: function () {
      this.chart = this.collection.chart;
      this.listenTo(this.collection, 'add', this.renderTootltipItem);
      this.listenTo(this.collection, 'remove', this.checkTooltip);
      this.$el.css({
        padding: 10,
        margin: 0,
        'list-style': 'none'
      });
    },

    renderTootltipItem: function (item) {
      var position = this.collection.indexOf(item);
      var tooltipPointView = new TooltipItemView({ model: item });

      if (position == 0) {
          this.$el.prepend(tooltipPointView.el);
      } else {
          $(this.$('li')[position - 1]).after(tooltipPointView.el);
      }

      this.setTooltipPosition();
    },

    setTooltipPosition: _.debounce(function () {
      if (this.collection.models.length > 0) {
        var x_min = this.chart.xScale(_.min(this.collection.map(function (item) { return item.get('x'); })));
        var x_max = this.chart.xScale(_.max(this.collection.map(function (item) { return item.get('x'); })));

        if (x_min > this.chart.canvas.main.width / 2) {
          this.collection.side = 'left';
        } else {
          this.collection.side = 'right';
        }

        if (this.collection.side == 'left') {
          this.collection.max_width = x_min - 2 * this.chart.tooltip_offset;
        } else {
          this.collection.max_width = this.chart.canvas.main.width - x_max - 2 * this.chart.tooltip_offset;
        }

        this.collection.$container.css('max-width', this.collection.max_width);

        this.collection.$container.show();
        var offset = this.chart.$chart_container.offset();
        this.collection.$container.offset({
          top: offset.top,
        });

        if (this.collection.side == 'left') {
          this.collection.$container.offset({
            left: offset.left + this.chart.canvas.left.width + x_min - this.collection.$container.width() - this.chart.tooltip_offset
          });
        } else {
          this.collection.$container.offset({
            left: offset.left + this.chart.canvas.left.width + x_max + this.chart.tooltip_offset
          })
        }
      }

    }, 10),

    checkTooltip: function (model) {
      if (this.collection.length == 0) this.collection.$container.hide();
    }

  });

  // TooltipItemView
  // -------------------

  // A view extention for rendering tooltip items

  var TooltipItemView = O_o.View.extend({
     tagName: 'li',
     className: 'tooltip item',

    initialize: function () {
      this.chart = this.model.collection.chart;
      this.listenTo(this.model, 'remove', this.remove)
      this.render();
      this.$el.css({
        margin: 0,
        padding: 0
      });
    },

    render: function () {
      this.$el.append($('<div>', { class: 'tooltip item-color' }).css({
        position: 'absolute',
        width: 8,
        height: 8,
        'margin-top': 4,
        'background-color': this.model.collection.color.lineStrokeColor
      }));

      var tooltip_item = $('<div>', { class: 'tooltip item-text' });
      var text = this.model.get('y');
      if (this.model.get('meta')) {
        text = this.model.get('meta') + ': ' + text;
      }

      tooltip_item.html(text);

      tooltip_item.css({
        'margin-left': 20,
        'margin-bottom': 5,
        'color': this.chart.tooltip_font_color,
        'font-family': this.chart.tooltip_font_family,
        'font-size': this.chart.tooltip_font_size,
        'font-weight': this.chart.tooltip_font_weight,
        'letter-spacing': this.chart.tooltip_letter_spacing,
        'word-wrap': 'break-word',
        'cursor': 'default'
      });

      this.$el.append(tooltip_item);
    }

  });

  // LegendView
  // -------------------

  // A view extention for rendering the legend

  var LegendView = O_o.View.extend({
    tagName: 'ul',
    className: 'legend',

    events: {
      'click .toggle-icon': 'toggle'
    },

    initialize: function () {
      this.is_collapsed = true;
      this.listenTo(O_o, 'render', this._applyCss);
      this.listenTo(O_o, 'shrink', this._releaseWidth);
      this.listenTo(this.model, 'render_legend', this.render);
      this._createToggleIcon();
      this.render();
    },

    render: function () {
      // temp ul to contain items in order to figure out max width
      var $temp_div = $('<div>').css({
        visibility: 'hidden',
        position: 'absolute'
      });

      _.each(this.model.datasets, function (dataset) {
        var legend_item_view = new LegendItemView({
          collection: dataset
        });

        this.$el.append(legend_item_view.$el);

        // add each legend text to temp div
        $temp_div.append(legend_item_view.$legend_text.clone());

      }, this);

      $('body').append($temp_div);
      this.max_legend_item_width = $temp_div.width();
      this._setItemWidth();
      $temp_div.remove();

      this.$el.css({
        margin: 0,
        padding: 0,
        border: '1px solid rgba(0,0,0,0.2)',
        position: 'relative'
      });
    },

    toggle: function () {
      this.is_collapsed = !this.is_collapsed;
      this._applyCss();
    },

    _isOverflowing: function () {
      var $li = this.$el.find('li');
      this.legend_item_outer_height = $li.outerHeight(true);
      this.$el.css({ height: 'auto' });
      return (this.$el.height() > this.legend_item_outer_height);
    },

    _applyCss: function () {
      this._setItemWidth();
      // for aesthetic reasons, set the width so lengend only resizes along with the chart
      this.$el.outerWidth(this.model.width);

      if (!this._isOverflowing()) {
        if (this.$toggle_icon) {
          this.$toggle_icon.hide();
        }
        return;
      }
      if (this.is_collapsed) {
        this.$el.css({
          overflow: 'hidden',
          height: this.legend_item_outer_height
        });
        this.$toggle_icon.html('+');
        this.$toggle_icon.show();
      } else {
        this.$el.css({
          overflow: 'visible',
          height:  'auto'
        });
        this.$toggle_icon.html('-');
        this.$toggle_icon.show();
      }
    },

    _setItemWidth: function () {
      if (this.model.$chart_container.width() > 2 * this.max_legend_item_width) {
        this.$el.find('li').width(this.max_legend_item_width + 2).css({ display: 'inline-block' });; // + 2 for possible rendering inaccuracy
      } else {
        this.$el.find('li').width('auto').css({ display: 'block' });
      }
    },

    _createToggleIcon: function () {
      this.$toggle_icon = $('<div>', { class: 'toggle-icon' }).css({
        position: 'absolute',
        top: 0,
        right: 0,
        color: '#666',
        'line-height': '14px',
        width: 20,
        height: 20,
        'font-size': 20,
        'text-align': 'center',
        'font-family': this.model.legend_font_family,
        cursor: 'pointer',
        '-webkit-touch-callout': 'none',
        '-webkit-user-select': 'none',
        '-khtml-user-select': 'none',
        '-moz-user-select': 'none',
        '-ms-user-select': 'none',
        'user-select': 'none'
      })
      this.$el.append(this.$toggle_icon);
    },

    _releaseWidth: function () {
      this.$el.width('auto');
    }

  });


  // LegendItemView
  // -------------------

  // A view extention for rendering legend items

  var LegendItemView = O_o.View.extend({
    tagName: 'li',

    events: {
      'mouseenter': 'highlight',
      'mouseleave': 'removeHighlight'
    },

    initialize: function () {
      this.chart = this.collection.chart;
      this.listenTo(this.collection, 'remove', this.remove);
      this.render();
    },

    render: function () {
      this.$el.append($('<div>', { class: 'legend-color' }).css({
        position: 'absolute',
        width: 8,
        height: 8,
        'margin-top': 4,
        'background-color': this.collection.color.lineStrokeColor
      }));

      this.$legend_text = $('<div>', { class: 'legend-text' }).html(this.collection.name);

      this.$legend_text.css({
        'margin-left': 20,
        'color': this.chart.legend_font_color,
        'font-family': this.chart.legend_font_family,
        'font-size': this.chart.legend_font_size,
        cursor: 'default'
      });

      this.$el.css({
        display: 'inline-block',
        'margin': 10
      });

      this.$el.append(this.$legend_text);
    },

    highlight: function () {
      this.collection.trigger('highlight')
    },

    removeHighlight: function () {
      this.collection.trigger('remove_highlight')
    }
  });


  return O_o;

}));