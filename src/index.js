import Compose                  from "common-micro-libs/src/jsutils/Compose"
import dataStore                from "common-micro-libs/src/jsutils/dataStore"
import objectExtend             from "common-micro-libs/src/jsutils/objectExtend"
import getObjectPropValue       from "common-micro-libs/src/jsutils/getObjectPropValue"
import FetchPollyfill           from "common-micro-libs/src/jsutils/es7-fetch"
import fetchCheckForHttpErrors  from "common-micro-libs/src/jsutils/fetchCheckForHttpErrors"

//=====================================================================
const PRIVATE           = dataStore.create();
const DEFAULT_LOCALE    = "en-us";
const NAVIGATOR         = navigator;
const _toLowerCase      = Function.call.bind(String.prototype.toLowerCase);
const fetch             = FetchPollyfill.fetch;

/**
 * An i18n resource loader and storage library. Allow for widgets to
 * store their default i18n resources here, as well as for applications to
 * then load additional languages from .json files at runtime.
 *
 * @class I18nResourceManager
 * @extends Compose
 *
 * @param {Object} options
 */
const I18nResourceManager = Compose.extend(/** @lends I18nResourceManager.prototype */{
    init: function (options) {
        let opt = objectExtend({}, this.getFactory().defaults, options);
        let inst = {
            opt:        opt,
            locale:     _toLowerCase(opt.locale || DEFAULT_LOCALE),
            resources:  {} // Structure: { 'en-us': { namespace: {value} }  }
        };

        PRIVATE.set(this, inst);

        this.onDestroy(function () {
            // Destroy all Compose object
            Object.keys(inst).forEach(function (prop) {
                if (inst[prop]) {
                    // Widgets
                    if (inst[prop].destroy) {
                        inst[prop].destroy();

                        // DOM events
                    } else if (inst[prop].remove) {
                        inst[prop].remove();

                        // EventEmitter events
                    } else if (inst[prop].off) {
                        inst[prop].off();
                    }

                    inst[prop] = undefined;
                }
            });

            PRIVATE.delete(this);
        }.bind(this));
    },

    /**
     * Returns the resource for a given namespace
     *
     * @param options
     *
     * @param {String} options.namespace
     *  A namespace to be retrieved under the given locale. Could be a key.path.
     *
     * @param {String} [options.locale=this.getDefaultLocale()]
     *  The locale to retrieve. Ex. `en` or `en-us`
     *
     * @param {*} [options.default=null]
     *  The default value to be returned if the requested data is "falsey"
     *
     * @param {Boolean} [options.original=false]
     *  By default, this method returns a clone of the data that was requested.
     *  Setting this to `true` will return the original reference.
     *
     * @returns {*}
     */
    get: function(options){
        let resources   = PRIVATE.get(this).resources;
        let opt         = objectExtend({
            locale:     "",
            namespace:  "",
            default:    null,
            original:   false
        }, options);

        if (!opt.namespace) {
            return opt.default;
        }

        if (!opt.locale) {
            opt.locale = _toLowerCase(this.getDefaultLocale() || DEFAULT_LOCALE);
        }

        let response = getObjectPropValue(resources, `${ opt.locale }.${ opt.namespace }`);

        if (!response) {
            return opt.default;
        }

        if (response && !opt.original && isTrueObject(response)) {
            response = objectExtend(true, {}, response);
        }

        return response;
    },

    /**
     * Store resource data for a given namespace.
     *
     * @param {Object} options
     * @param {String} options.namespace
     *  The Namespace where the data should be stored. Should be a unique
     *  name (NOT A key.path).
     *
     * @param {*} options.data
     *  the Data to be stored. Normally an object. Note that this data will
     *  be stored as given on input. Any changes to the object will also
     *  impact data stored here.
     *
     * @param {String}  [options.locale="en-us]
     */
    store: function (options) {
        let resources   = PRIVATE.get(this).resources;
        let opt         = objectExtend({
            locale:     "en-us",
            namespace:  "",
            data:       null
        }, options);

        if (!opt.namespace) {
            return;
        }

        let locale = _toLowerCase(opt.locale || DEFAULT_LOCALE);

        if (!(locale in resources)) {
            resources[locale] = {};
        }

        resources[locale][opt.namespace] = opt.data;
    },

    /**
     * Returns a clone of the entire set of data currently store in
     * the instance.
     *
     * @return {Object}
     */
    toJSON: function () {
        return JSON.parse(JSON.stringify(PRIVATE.get(this).resources));
    },

    setDefaultLocale: function (locale) {
        PRIVATE.get(this).locale = _toLowerCase(locale || DEFAULT_LOCALE);
    },

    /**
     * Returns the current default locale.
     *
     * @returns {String}
     */
    getDefaultLocale: function(){
        return PRIVATE.get(this).locale;
    },

    /**
     * Returns the preferred browser locale
     *
     * @return {String}
     */
    getBrowserLocale: getBrowserLocale,

    /**
     * Loads a JSON file containing the i18n for the given locale

     * @param {String} jsonFileUrl
     * @param {String} [locale]
     * @param {String} [options]
     * @param {Function} [options.onLoad]
     *  A callback function called before data is added to storage. Callback
     *  is given the data as input. If callback returns an object, then that
     *  new object will be stored.
     *
     * @return {Promise<I18nResourceManager, Error>}
     */
    load: function (jsonFileUrl, locale, options) {
        let opt = objectExtend({ onLoad: null }, options);

        return fetch(jsonFileUrl)
            .then(fetchCheckForHttpErrors)
            .then(response => response.json())
            .then(data => {
                let resources   = PRIVATE.get(this).resources;
                let localeCode  = _toLowerCase(locale || DEFAULT_LOCALE);

                if (!(localeCode in resources)) {
                    resources[localeCode] = {};
                }

                if (opt.onLoad) {
                    let data2 = opt.onLoad(data);
                    if (data2) {
                        data = data2;
                    }
                }

                objectExtend(true, resources[localeCode], data);
            });
    },
});

function isTrueObject(obj) {
    return Object.prototype.toString.call(obj) === "[object Object]";
}

function getBrowserLocale() {
    return NAVIGATOR.language || NAVIGATOR.userLanguage;
}

/**
 * Default options for Utility.
 *
 * @type {Object}
 * @property {String} locale
 *  The default locale for the instance. Defaults to `en-US`
 */
I18nResourceManager.defaults = {
    locale: DEFAULT_LOCALE
};

/**
 * Returns the browser preferred Locale
 *
 * @Method I18nResourceManager.getBrowserLocale
 * @returns {String}
 */
I18nResourceManager.getBrowserLocale = getBrowserLocale;

/**
 * An i18n resource manager global instance.
 *
 * @type {I18nResourceManager}
 */
I18nResourceManager.resources = I18nResourceManager.create();

export default I18nResourceManager;
