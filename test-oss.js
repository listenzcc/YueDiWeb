const STS = require('@alicloud/sts20150401');

const stsClient = new STS.default({
    accessKeyId: 'accessKeyId',
    accessKeySecret: 'accessKeySecret',
    endpoint: 'sts.aliyuncs.com',
    apiVersion: '2015-04-01'
})

console.log(stsClient)

console.log(stsClient.assumeRole)