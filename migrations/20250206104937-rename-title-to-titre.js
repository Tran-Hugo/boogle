'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('books', 'titre', 'title');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('books', 'title', 'titre');
  }
};