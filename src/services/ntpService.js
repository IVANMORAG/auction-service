const ntpClient = require('ntp-client');
const logger = require('../utils/logger');

const getTime = () => {
  return new Promise((resolve, reject) => {
    ntpClient.getNetworkTime(process.env.NTP_SERVER, 123, (err, date) => {
      if (err) {
        logger.error('Error obteniendo tiempo NTP:', err);
        reject(err);
        return;
      }
      resolve(date);
    });
  });
};

module.exports = { getTime };