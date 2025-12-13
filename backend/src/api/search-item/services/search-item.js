'use strict';

/**
 * search-item service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::search-item.search-item');
