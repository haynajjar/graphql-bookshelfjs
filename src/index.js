'use strict';

const loaders = require('./loaders');

/**
 * Quick workaround allowing GraphQL to access model attributes directly
 * (to access a bookshelf model attribute (like model.name), we have to use the .get() method)
 *
 * @param {object} collection
 * @returns {*}
 */
function exposeAttributes(collection,context) {

    function exposeModelAttributes(item) {
        // Make sure that relations are excluded
        return Object.assign(item, item.serialize({ shallow: true }));
    }
    if (collection) {
        if (collection.hasOwnProperty('length')) {
            let list = collection.map((item) => { return exposeModelAttributes(item); })
            if(context)
                context.pagination = collection.pagination
            return  list
        }
        return exposeModelAttributes(collection);
    }
    return collection;
}

module.exports = {

    /**
     *
     * @returns {function}
     */
    getLoaders() {
        return loaders;
    },

    /**
     *
     * @param {function} Model
     * @returns {function}
     */
    resolverFactory(Model) {
        return function resolver(modelInstance, args, context, info, extra, pageOptions) {
            const isAssociation = (typeof Model.prototype[info.fieldName] === 'function');
            const model = isAssociation ? modelInstance.related(info.fieldName) : new Model();
            for (const key in args) {
                model.where(`${model.tableName}.${key}`, args[key]);
            }
            if (extra) {
                switch (typeof extra) {
                    case 'function':
                        extra(model);
                        break;

                    case 'object':
                        for (const key in extra) {
                            model[key](...extra[key]);
                            delete extra[key];
                        }
                        break;

                    default:
                        return Promise.reject('Parameter [extra] should be either a function or an object');
                }
            }
            if (isAssociation) {
                context && context.loaders && context.loaders(model);
                return model.fetch().then((c) => { return exposeAttributes(c); });
            }
            const fn = (info.returnType.constructor.name === 'GraphQLList') ? (pageOptions ? 'fetchPage' : 'fetchAll') : 'fetch';
            const modelFn = pageOptions ? model[fn](pageOptions) : model[fn]()
            return modelFn.then((c) => { return exposeAttributes(c,context); });
        };
    },

};
