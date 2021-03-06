﻿using ImageProcessor;
using ImageProcessor.Imaging;
using ImageProcessor.Imaging.Formats;
using Microsoft.WindowsAzure.Storage.Blob;
using Microsoft.WindowsAzure.Storage.RetryPolicies;
using Sahara.Core.Common.ResponseTypes;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;

namespace Sahara.Core.Imaging
{
    public class SwatchPropertyImageProcessor
    {
        /// <summary>
        /// For account users we auto crop to profile photo specs, account user does not use cropping tools
        /// </summary>
        /// <param name="imageByteArray"></param>
        /// <returns></returns>
        public DataAccessResponseType ProcessSwatchImage(string accountId, string storagePartition, byte[] imageByteArray)
        {
            

            //Create image id and response object
            string imageId = System.Guid.NewGuid().ToString(); //<-- Stored on "Photo" column of user table
            var response = new DataAccessResponseType();

            var folderName = Sahara.Core.Settings.Imaging.Images.SwatchPropertyImageFolderName;

            //Image Format Settings
            var outputFormatString = ".jpg";
            ISupportedImageFormat outputFormatProcessorProperty = new JpegFormat { Quality = 90 }; // <-- Format is automatically detected though can be changed.
            var outputFormatSystemrawingFormat = System.Drawing.Imaging.ImageFormat.Jpeg;

            Bitmap bmpSource;

            //Convert source byte[] to MemoryStream
            using (var sourceStream = new MemoryStream(imageByteArray))
            {
                bmpSource = new Bitmap(sourceStream); //<--Convert to BMP in order to run verifications


                //TO DO: IF ASPECT RATIO EXISTS THEN WE DETRIMINE THE SET SIZE (1 only) by method

                var setSizes = new List<Size>();
                setSizes.Add(new Size { Height = 300, Width = 300 });
                setSizes.Add(new Size { Height = 150, Width = 150 });
                setSizes.Add(new Size { Height = 75, Width = 75 });

                //Loop through all image sizes, resize & save a version for each one
                foreach (var size in setSizes)
                {
                    var filename = imageId + outputFormatString; //<-- guid.xxx

                    //Final location for EACH image will be: http://[uri]/[containerName]/[imageId]_[w]x[h].[format]
                    if (size.Height == 150)
                    {
                        filename = filename.Replace(".jpg", "_md.jpg");
                    }
                    else if(size.Height == 75)
                    {
                        filename = filename.Replace(".jpg", "_sm.jpg");
                    }
                    
                    #region Image Processor & Storage

                    Size processingSize = size;
                    var resizeLayer = new ResizeLayer(processingSize) { ResizeMode = ResizeMode.Crop, AnchorPosition = AnchorPosition.Center };


                    using (MemoryStream outStream = new MemoryStream())
                    {
                        using (ImageFactory imageFactory = new ImageFactory())
                        {
                            //var cropLayer = new ImageProcessor.Imaging.CropLayer(0,0,885,700,CropMode.Pixels);

                            // Load, resize, set the format and quality and save an image.
                            // Applies all in order...
                            sourceStream.Position = 0;
                            imageFactory.Load(sourceStream)
                                        .Resize(resizeLayer)
                                        .Format(outputFormatProcessorProperty)
                                        .Save(outStream);

                        }


                        //Store each image size to BLOB STORAGE ---------------------------------
                        #region BLOB STORAGE

                        //CloudBlobClient blobClient = Sahara.Core.Settings.Azure.Storage.StorageConnections.AccountsStorage.CreateCloudBlobClient();
                        CloudBlobClient blobClient = Settings.Azure.Storage.GetStoragePartitionAccount(storagePartition).CreateCloudBlobClient();

                        //Create and set retry policy
                        IRetryPolicy exponentialRetryPolicy = new ExponentialRetry(TimeSpan.FromMilliseconds(400), 6);
                        blobClient.DefaultRequestOptions.RetryPolicy = exponentialRetryPolicy;

                        //Creat/Connect to the Blob Container
                        blobClient.GetContainerReference(accountId).CreateIfNotExists(BlobContainerPublicAccessType.Blob); //<-- Create and make public
                        CloudBlobContainer blobContainer = blobClient.GetContainerReference(accountId);

                        //Get reference to the picture blob or create if not exists. 
                        CloudBlockBlob blockBlob = blobContainer.GetBlockBlobReference(folderName + "/" + filename);

                        //Save to storage
                        //Convert final BMP to byteArray
                        Byte[] finalByteArray;

                        finalByteArray = outStream.ToArray();

                        blockBlob.UploadFromByteArray(finalByteArray, 0, finalByteArray.Length);

                        #endregion
                    }


                    #endregion
                }
            }


            //var cdnUrl = Settings.Azure.Storage.GetStoragePartition(storagePartition).CDN;

            //Send the imageId in the response object
            response.isSuccess = true;
            response.SuccessCode = imageId;
            //response.SuccessMessage = "http://" + cdnUrl + "/" + accountId + "/" + folderName + "/" + imageId + outputFormatString; //<-- CDN now added by API in case of future CDN migrations
            response.SuccessMessage = accountId + "/" + folderName + "/" + imageId + outputFormatString;
            return response;
        }
    }
}
