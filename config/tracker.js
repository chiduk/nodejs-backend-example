let request = require('request');
let key = '';
module.exports = {
    key: key,
    getCompanyList: (callback) => {
        let options = {
            url: '',
            headers:{
                accept: "application/json;charset=UTF-8"
            }
        };

        request(options, callback)
    },

};