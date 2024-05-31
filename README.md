#TODO:

the file chunking needs work:
https://github.com/feross/simple-peer/issues/561

Module to chunk streams: https://www.npmjs.com/package/chunk-stream

Blog about maximum chunk size for RTCDataChannels (recommends 16kb chunks): http://viblast.com/blog/2015/2/5/webrtc-data-channel-message-size/

var chunks = require('chunk-stream')
inputStream.pipe(chunks(16000)).pipe(peer)
or, with write:

var chunks = require('chunk-stream')
var chunkStream = chunks(16000)
chunkStream.pipe(peer)

chunkStream.write(myData)
https://chatgpt.com/c/82e3fa4e-0338-469b-91f6-2a9e8a865490
