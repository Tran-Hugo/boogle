module.exports = (sequelize, DataTypes) => {
    const books = sequelize.define('books', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        authors: {
            type: DataTypes.JSON,
            defaultValue: []
        },
        summary: {
            type: DataTypes.STRING,
        },
        content : {
            type: DataTypes.TEXT,
        },
        image : {
            type: DataTypes.STRING,
            allowNull: true,
        },
        score : {
            type: DataTypes.FLOAT,
            defaultValue: 0
        }
    });
    
    return books;
}