const { DataTypes } = require('sequelize');

// Exportamos una funcion que define el modelo
// Luego le injectamos la conexion a sequelize.
module.exports = (sequelize) => {
  // defino el modelo
  sequelize.define('room', {
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      unique: true,
    },
    players:{
      type:DataTypes.INTEGER,
      allowNull:true,
      defaultValue:1,
      validate: {
        min: 0,
        max: 10,
      },

    }
  }, {
    timestamps: false
  });
};
