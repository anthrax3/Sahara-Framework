﻿namespace Sahara.Core.Common.MessageQueues.PlatformPipeline
{

    /// <summary>
    /// A static helper class to access configuration constants that do not change across deployment environments
    /// </summary>
    internal static class PipelineSettings
    {

        internal const string QueueReferenceName = "platform-message-pipeline";

    }
}