import { z } from "zod/v4";
import type {
  StagehandRpcNotificationSchema,
  StagehandRpcRequestSchema,
  StagehandMethodSchema,
  StagehandSendToHostBindingSchema,
} from "./schema-registry.js";
import type {
  ActionSchema,
  ActOptionsSchema,
  ActResultDataSchema,
  ActResultSchema,
  AnthropicModelIdSchema,
  AnthropicModelNameSchema,
  ApiKeyAuthSchema,
  AzureEntraIdAuthSchema,
  AzureModelProviderOptionsSchema,
  AzureProviderOptionsSchema,
  BrowserbaseBrowserSettingsSchema,
  BrowserSessionMetadataSchema,
  BrowserbaseContextSchema,
  BrowserbaseFingerprintSchema,
  BrowserbaseFingerprintScreenSchema,
  BrowserbaseProxyConfigSchema,
  BrowserbaseProxyGeolocationSchema,
  BrowserbaseRegionSchema,
  BrowserbaseSessionCreateParamsSchema,
  CallbackBatchOptionsSchema,
  CallbackBatchParamsSchema,
  CallbackBatchResultSchema,
  BrowserbaseViewportSchema,
  CacheMetadataSchema,
  CacheStatusSchema,
  CacheTokenSavingsSchema,
  CachingSchema,
  CerebrasModelIdSchema,
  CerebrasModelNameSchema,
  ClientOptionsBaseSchema,
  ClientOptionsSchema,
  ClientModelReferenceSchema,
  ClearCookieOptionsSchema,
  ContextActivePageResultSchema,
  ContextAddCookiesParamsSchema,
  ContextAddInitScriptParamsSchema,
  ContextClearCookiesParamsSchema,
  ContextClipboardClearParamsSchema,
  ContextClipboardCopyParamsSchema,
  ContextClipboardCutParamsSchema,
  ContextClipboardPasteParamsSchema,
  ContextClipboardReadTextParamsSchema,
  ContextClipboardReadTextResultSchema,
  ContextClipboardTargetSchema,
  ContextClipboardWriteTextParamsSchema,
  ContextCookiesParamsSchema,
  ContextCookiesResultSchema,
  ContextGetDomainPolicyResultSchema,
  ContextNewPageParamsSchema,
  ContextPagesResultSchema,
  ContextSetActivePageParamsSchema,
  ContextSetDomainPolicyParamsSchema,
  ContextSetExtraHTTPHeadersParamsSchema,
  ContextVoidResultSchema,
  CookieFilterSchema,
  CookieParamSchema,
  CookieRegexSchema,
  CookieSchema,
  DefaultExtractDataSchema,
  DomainPolicySchema,
  EmptyParamsSchema,
  ExternalProxyConfigSchema,
  ExtractOptionsSchema,
  ExtractResultSchema,
  GoogleModelIdSchema,
  GoogleModelNameSchema,
  GoogleServiceAccountAuthSchema,
  GoogleServiceAccountCredentialsSchema,
  ImplementationInfoSchema,
  InputFilePayloadSchema,
  LocatorClickParamsSchema,
  LocatorClickResultSchema,
  LocatorCentroidResultSchema,
  LocatorCountResultSchema,
  LocatorDescriptorSchema,
  LocatorFillParamsSchema,
  LocatorFillResultSchema,
  LocatorHighlightParamsSchema,
  LocatorHighlightResultSchema,
  LocatorHoverResultSchema,
  LocatorInnerHtmlResultSchema,
  LocatorInnerTextResultSchema,
  LocatorInputValueResultSchema,
  LocatorIsCheckedResultSchema,
  LocatorIsVisibleResultSchema,
  LocatorSchema,
  LocatorScrollToParamsSchema,
  LocatorScrollToResultSchema,
  LocatorSelectOptionParamsSchema,
  LocatorSelectOptionResultSchema,
  LocatorSetInputFilesParamsSchema,
  LocatorSetInputFilesResultSchema,
  LocatorSendClickEventParamsSchema,
  LocatorSendClickEventResultSchema,
  LocatorTextContentResultSchema,
  LocatorTypeParamsSchema,
  LocatorTypeResultSchema,
  LoadStateSchema,
  LLMGenerateParamsSchema,
  LLMGenerateResultSchema,
  LLMAnnotationsSchema,
  LLMClientToolSchema,
  LLMImageContentSchema,
  LLMJsonSchemaResponseFormatSchema,
  LLMMessageSchema,
  LLMMessageContentBlockSchema,
  LLMMessageGenerateParamsSchema,
  LLMMessageGenerateResultSchema,
  LLMResponseFormatSchema,
  LLMRoleSchema,
  LLMStructuredGenerateParamsSchema,
  LLMStructuredGenerateResultSchema,
  LLMTextContentSchema,
  LLMTextResponseFormatSchema,
  LLMToolSchema,
  LLMToolAnnotationsSchema,
  LLMToolChoiceSchema,
  LLMToolExecutionSchema,
  LLMToolIconSchema,
  LLMToolResultContentSchema,
  LLMToolUseContentSchema,
  LLMUsageSchema,
  LocalBrowserLaunchOptionsSchema,
  MouseButtonSchema,
  NavigationFinishedErrorSchema,
  NavigationHeaderSchema,
  NavigationResponseDescriptorSchema,
  NavigationSecurityDetailsSchema,
  NavigationServerAddrSchema,
  ModelAuthSchema,
  ModelConfigSchema,
  ModelNameSchema,
  ModelProviderOptionsSchema,
  ModelProviderSchema,
  GroqModelIdSchema,
  GroqModelNameSchema,
  ObserveOptionsSchema,
  ObserveResultSchema,
  PageAddInitScriptParamsSchema,
  PageCDPEventNotificationSchema,
  PageCDPEventParamsSchema,
  PageCDPEventSchema,
  PageClickParamsSchema,
  PageCloseResultSchema,
  PageDragAndDropParamsSchema,
  PageDragAndDropRoutePointSchema,
  PageEvaluateParamsSchema,
  PageEvaluateResultSchema,
  PageGoBackParamsSchema,
  PageGoForwardParamsSchema,
  PageGotoParamsSchema,
  PageHoverParamsSchema,
  PageIdParamsSchema,
  PageKeyPressParamsSchema,
  PageEventNameSchema,
  PageLocatorSchema,
  PageNavigationResultSchema,
  PageNavigationOptionsSchema,
  PageOffParamsSchema,
  PageOnParamsSchema,
  PageRefSchema,
  PageReloadParamsSchema,
  PageScreenshotOptionsSchema,
  PageScreenshotParamsSchema,
  PageScreenshotClipSchema,
  PageScreenshotResultSchema,
  PageScrollParamsSchema,
  PageSetExtraHTTPHeadersParamsSchema,
  PageSetViewportSizeParamsSchema,
  PageSnapshotParamsSchema,
  PageSnapshotOptionsSchema,
  PageTitleResultSchema,
  PageTypeParamsSchema,
  PageUrlResultSchema,
  PageVoidResultSchema,
  PageWaitForLoadStateParamsSchema,
  PageWaitForSelectorParamsSchema,
  PageWaitForSelectorResultSchema,
  PageWaitForTimeoutParamsSchema,
  PageWebMCPCancelInvocationParamsSchema,
  PageWebMCPInvocationResultParamsSchema,
  PageWebMCPInvokeToolParamsSchema,
  PageWebMCPToolsParamsSchema,
  PageWebMCPToolsResultSchema,
  ProxyConfigSchema,
  ResponseAllHeadersResultSchema,
  ResponseBodyResultSchema,
  ResponseFinishedResultSchema,
  ResponseHeadersArrayResultSchema,
  ResponseIdParamsSchema,
  ResponseSecurityDetailsResultSchema,
  ResponseServerAddrResultSchema,
  RuntimeDescriptorSchema,
  RgbaColorSchema,
  StagehandActParamsSchema,
  StagehandCloseResultSchema,
  StagehandExtractParamsSchema,
  StagehandInitParamsSchema,
  StagehandInitResultSchema,
  StagehandLogDataSchema,
  StagehandLogLevelSchema,
  StagehandLogSchema,
  StagehandMetricsSchema,
  StagehandObserveParamsSchema,
  StagehandResultMetadataSchema,
  StagehandResultUsageSchema,
  SnapshotResultSchema,
  TelemetryConfigSchema,
  ThinkingEffortSchema,
  OpenAIModelIdSchema,
  OpenAIModelNameSchema,
  VariablePrimitiveSchema,
  VariablesSchema,
  VariableValueSchema,
  VertexModelProviderOptionsSchema,
  VertexProviderOptionsSchema,
  WebMCPAnnotationSchema,
  WebMCPInvocationDescriptorSchema,
  WebMCPInvocationStatusSchema,
  WebMCPInvokeOptionsSchema,
  WebMCPRemoteObjectSchema,
  WebMCPResultOptionsSchema,
  WebMCPToolDescriptorSchema,
  WebMCPToolResponseSchema,
  WebMCPToolsOptionsSchema,
} from "./schemas.js";

export type VariablePrimitive = z.output<typeof VariablePrimitiveSchema>;
export type VariableValue = z.output<typeof VariableValueSchema>;
export type Variables = z.output<typeof VariablesSchema>;
export type PageLocator = z.output<typeof PageLocatorSchema>;
export type Locator = z.output<typeof LocatorSchema>;
export type MouseButton = z.output<typeof MouseButtonSchema>;
export type StagehandMetrics = z.output<typeof StagehandMetricsSchema>;
export type CallbackBatchOptions = z.output<typeof CallbackBatchOptionsSchema>;
export type CallbackBatchParams = z.output<typeof CallbackBatchParamsSchema>;
export type CallbackBatchResult = z.output<typeof CallbackBatchResultSchema>;
export type GoogleServiceAccountCredentials = z.output<
  typeof GoogleServiceAccountCredentialsSchema
>;
export type GoogleServiceAccountAuth = z.output<typeof GoogleServiceAccountAuthSchema>;
export type AzureEntraIdAuth = z.output<typeof AzureEntraIdAuthSchema>;
export type VertexProviderOptions = z.output<typeof VertexProviderOptionsSchema>;
export type AzureProviderOptions = z.output<typeof AzureProviderOptionsSchema>;
export type VertexModelProviderOptions = z.output<typeof VertexModelProviderOptionsSchema>;
export type AzureModelProviderOptions = z.output<typeof AzureModelProviderOptionsSchema>;
export type OpenAIModelId = z.output<typeof OpenAIModelIdSchema>;
export type AnthropicModelId = z.output<typeof AnthropicModelIdSchema>;
export type GoogleModelId = z.output<typeof GoogleModelIdSchema>;
export type GroqModelId = z.output<typeof GroqModelIdSchema>;
export type CerebrasModelId = z.output<typeof CerebrasModelIdSchema>;
export type OpenAIModelName = z.output<typeof OpenAIModelNameSchema>;
export type AnthropicModelName = z.output<typeof AnthropicModelNameSchema>;
export type GoogleModelName = z.output<typeof GoogleModelNameSchema>;
export type GroqModelName = z.output<typeof GroqModelNameSchema>;
export type CerebrasModelName = z.output<typeof CerebrasModelNameSchema>;
export type ModelConfig = z.output<typeof ModelConfigSchema>;
export type ModelName = z.output<typeof ModelNameSchema>;
export type ModelProvider = z.output<typeof ModelProviderSchema>;
export type LLMAnnotations = z.output<typeof LLMAnnotationsSchema>;
export type LLMClientTool = z.output<typeof LLMClientToolSchema>;
export type LLMImageContent = z.output<typeof LLMImageContentSchema>;
export type LLMJsonSchemaResponseFormat = z.output<typeof LLMJsonSchemaResponseFormatSchema>;
export type LLMMessage = z.output<typeof LLMMessageSchema>;
export type LLMMessageContentBlock = z.output<typeof LLMMessageContentBlockSchema>;
export type LLMMessageGenerateParams = z.output<typeof LLMMessageGenerateParamsSchema>;
export type LLMMessageGenerateResult = z.output<typeof LLMMessageGenerateResultSchema>;
export type LLMResponseFormat = z.output<typeof LLMResponseFormatSchema>;
export type LLMRole = z.output<typeof LLMRoleSchema>;
export type LLMStructuredGenerateParams = z.output<typeof LLMStructuredGenerateParamsSchema>;
export type LLMStructuredGenerateResult = z.output<typeof LLMStructuredGenerateResultSchema>;
export type LLMTextContent = z.output<typeof LLMTextContentSchema>;
export type LLMTextResponseFormat = z.output<typeof LLMTextResponseFormatSchema>;
export type LLMToolAnnotations = z.output<typeof LLMToolAnnotationsSchema>;
export type LLMToolChoice = z.output<typeof LLMToolChoiceSchema>;
export type LLMToolExecution = z.output<typeof LLMToolExecutionSchema>;
export type LLMToolIcon = z.output<typeof LLMToolIconSchema>;
export type LLMToolResultContent = z.output<typeof LLMToolResultContentSchema>;
export type LLMToolUseContent = z.output<typeof LLMToolUseContentSchema>;
export type LLMUsage = z.output<typeof LLMUsageSchema>;
export type LLMGenerateParams = z.output<typeof LLMGenerateParamsSchema>;
export type LLMGenerateResult = z.output<typeof LLMGenerateResultSchema>;
export type ClientModelReference = z.output<typeof ClientModelReferenceSchema>;
export type Action = z.output<typeof ActionSchema>;
export type ActOptions = z.output<typeof ActOptionsSchema>;
export type ActResultData = z.output<typeof ActResultDataSchema>;
export type ActResult = z.output<typeof ActResultSchema>;
export type ExtractOptions = z.output<typeof ExtractOptionsSchema>;
export type ExtractResult = z.output<typeof ExtractResultSchema>;
export type DefaultExtractData = z.output<typeof DefaultExtractDataSchema>;
export type ObserveOptions = z.output<typeof ObserveOptionsSchema>;
export type ObserveResult = z.output<typeof ObserveResultSchema>;
export type EmptyParams = z.output<typeof EmptyParamsSchema>;
export type ContextVoidResult = z.output<typeof ContextVoidResultSchema>;
export type PageRef = z.output<typeof PageRefSchema>;
export type PageEventName = z.output<typeof PageEventNameSchema>;
export type PageCDPEventParams = z.output<typeof PageCDPEventParamsSchema>;
export type PageCDPEvent = z.output<typeof PageCDPEventSchema>;
export type PageCDPEventNotification = z.output<typeof PageCDPEventNotificationSchema>;
export type PageNavigationOptions = z.output<typeof PageNavigationOptionsSchema>;
export type NavigationHeader = z.output<typeof NavigationHeaderSchema>;
export type NavigationSecurityDetails = z.output<typeof NavigationSecurityDetailsSchema>;
export type NavigationServerAddr = z.output<typeof NavigationServerAddrSchema>;
export type NavigationFinishedError = z.output<typeof NavigationFinishedErrorSchema>;
export type NavigationResponseDescriptor = z.output<typeof NavigationResponseDescriptorSchema>;
export type PageNavigationResult = z.output<typeof PageNavigationResultSchema>;
export type ResponseIdParams = z.output<typeof ResponseIdParamsSchema>;
export type ResponseBodyResult = z.output<typeof ResponseBodyResultSchema>;
export type ResponseAllHeadersResult = z.output<typeof ResponseAllHeadersResultSchema>;
export type ResponseHeadersArrayResult = z.output<typeof ResponseHeadersArrayResultSchema>;
export type ResponseSecurityDetailsResult = z.output<typeof ResponseSecurityDetailsResultSchema>;
export type ResponseServerAddrResult = z.output<typeof ResponseServerAddrResultSchema>;
export type ResponseFinishedResult = z.output<typeof ResponseFinishedResultSchema>;
export type PageVoidResult = z.output<typeof PageVoidResultSchema>;
export type PageScreenshotClip = z.output<typeof PageScreenshotClipSchema>;
export type PageSnapshotOptions = z.output<typeof PageSnapshotOptionsSchema>;
export type SnapshotResult = z.output<typeof SnapshotResultSchema>;
export type WebMCPAnnotation = z.output<typeof WebMCPAnnotationSchema>;
export type WebMCPToolDescriptor = z.output<typeof WebMCPToolDescriptorSchema>;
export type WebMCPToolsOptions = z.output<typeof WebMCPToolsOptionsSchema>;
export type WebMCPInvokeOptions = z.output<typeof WebMCPInvokeOptionsSchema>;
export type WebMCPResultOptions = z.output<typeof WebMCPResultOptionsSchema>;
export type WebMCPInvocationDescriptor = z.output<typeof WebMCPInvocationDescriptorSchema>;
export type WebMCPInvocationStatus = z.output<typeof WebMCPInvocationStatusSchema>;
export type WebMCPRemoteObject = z.output<typeof WebMCPRemoteObjectSchema>;
export type WebMCPToolResponse = z.output<typeof WebMCPToolResponseSchema>;
export type LocatorDescriptor = z.output<typeof LocatorDescriptorSchema>;
export type StagehandInitParams = z.output<typeof StagehandInitParamsSchema>;
export type TelemetryConfig = z.output<typeof TelemetryConfigSchema>;
export type ImplementationInfo = z.output<typeof ImplementationInfoSchema>;
export type RuntimeDescriptor = z.output<typeof RuntimeDescriptorSchema>;
export type StagehandActParams = z.output<typeof StagehandActParamsSchema>;
export type StagehandObserveParams = z.output<typeof StagehandObserveParamsSchema>;
export type StagehandExtractParams = z.output<typeof StagehandExtractParamsSchema>;
export type ContextNewPageParams = z.output<typeof ContextNewPageParamsSchema>;
export type ContextCookiesParams = z.output<typeof ContextCookiesParamsSchema>;
export type ContextAddCookiesParams = z.output<typeof ContextAddCookiesParamsSchema>;
export type ContextClearCookiesParams = z.output<typeof ContextClearCookiesParamsSchema>;
export type ContextClipboardTarget = z.output<typeof ContextClipboardTargetSchema>;
export type ContextClipboardReadTextParams = z.output<typeof ContextClipboardReadTextParamsSchema>;
export type ContextClipboardWriteTextParams = z.output<
  typeof ContextClipboardWriteTextParamsSchema
>;
export type ContextClipboardClearParams = z.output<typeof ContextClipboardClearParamsSchema>;
export type ContextClipboardPasteParams = z.output<typeof ContextClipboardPasteParamsSchema>;
export type ContextClipboardCopyParams = z.output<typeof ContextClipboardCopyParamsSchema>;
export type ContextClipboardCutParams = z.output<typeof ContextClipboardCutParamsSchema>;
export type ContextSetActivePageParams = z.output<typeof ContextSetActivePageParamsSchema>;
export type ContextAddInitScriptParams = z.output<typeof ContextAddInitScriptParamsSchema>;
export type ContextSetExtraHTTPHeadersParams = z.output<
  typeof ContextSetExtraHTTPHeadersParamsSchema
>;
export type ContextSetDomainPolicyParams = z.output<typeof ContextSetDomainPolicyParamsSchema>;
export type PageGotoParams = z.output<typeof PageGotoParamsSchema>;
export type PageOnParams = z.output<typeof PageOnParamsSchema>;
export type PageOffParams = z.output<typeof PageOffParamsSchema>;
export type PageIdParams = z.output<typeof PageIdParamsSchema>;
export type PageReloadParams = z.output<typeof PageReloadParamsSchema>;
export type PageGoBackParams = z.output<typeof PageGoBackParamsSchema>;
export type PageGoForwardParams = z.output<typeof PageGoForwardParamsSchema>;
export type PageClickParams = z.output<typeof PageClickParamsSchema>;
export type PageHoverParams = z.output<typeof PageHoverParamsSchema>;
export type PageScrollParams = z.output<typeof PageScrollParamsSchema>;
export type PageDragAndDropParams = z.output<typeof PageDragAndDropParamsSchema>;
export type PageDragAndDropRoutePoint = z.output<typeof PageDragAndDropRoutePointSchema>;
export type PageTypeParams = z.output<typeof PageTypeParamsSchema>;
export type PageKeyPressParams = z.output<typeof PageKeyPressParamsSchema>;
export type PageEvaluateParams = z.output<typeof PageEvaluateParamsSchema>;
export type PageAddInitScriptParams = z.output<typeof PageAddInitScriptParamsSchema>;
export type PageSetExtraHTTPHeadersParams = z.output<typeof PageSetExtraHTTPHeadersParamsSchema>;
export type PageScreenshotOptions = z.output<typeof PageScreenshotOptionsSchema>;
export type PageScreenshotParams = z.output<typeof PageScreenshotParamsSchema>;
export type PageSnapshotParams = z.output<typeof PageSnapshotParamsSchema>;
export type PageSetViewportSizeParams = z.output<typeof PageSetViewportSizeParamsSchema>;
export type PageWaitForLoadStateParams = z.output<typeof PageWaitForLoadStateParamsSchema>;
export type PageWaitForTimeoutParams = z.output<typeof PageWaitForTimeoutParamsSchema>;
export type PageWaitForSelectorParams = z.output<typeof PageWaitForSelectorParamsSchema>;
export type PageWebMCPToolsParams = z.output<typeof PageWebMCPToolsParamsSchema>;
export type PageWebMCPToolsResult = z.output<typeof PageWebMCPToolsResultSchema>;
export type PageWebMCPInvokeToolParams = z.output<typeof PageWebMCPInvokeToolParamsSchema>;
export type PageWebMCPInvocationResultParams = z.output<
  typeof PageWebMCPInvocationResultParamsSchema
>;
export type PageWebMCPCancelInvocationParams = z.output<
  typeof PageWebMCPCancelInvocationParamsSchema
>;
export type LocatorClickParams = z.output<typeof LocatorClickParamsSchema>;
export type LocatorFillParams = z.output<typeof LocatorFillParamsSchema>;
export type LocatorScrollToParams = z.output<typeof LocatorScrollToParamsSchema>;
export type RgbaColor = z.output<typeof RgbaColorSchema>;
export type LocatorHighlightParams = z.output<typeof LocatorHighlightParamsSchema>;
export type LocatorSendClickEventParams = z.output<typeof LocatorSendClickEventParamsSchema>;
export type LocatorTypeParams = z.output<typeof LocatorTypeParamsSchema>;
export type LocatorSelectOptionParams = z.output<typeof LocatorSelectOptionParamsSchema>;
export type InputFilePayload = z.output<typeof InputFilePayloadSchema>;
export type LocatorSetInputFilesParams = z.output<typeof LocatorSetInputFilesParamsSchema>;
export type CacheStatus = z.output<typeof CacheStatusSchema>;
export type CacheTokenSavings = z.output<typeof CacheTokenSavingsSchema>;
export type CacheMetadata = z.output<typeof CacheMetadataSchema>;
export type StagehandResultUsage = z.output<typeof StagehandResultUsageSchema>;
export type StagehandResultMetadata = z.output<typeof StagehandResultMetadataSchema>;
export type StagehandInitResult = z.output<typeof StagehandInitResultSchema>;
export type StagehandCloseResult = z.output<typeof StagehandCloseResultSchema>;
export type ContextPagesResult = z.output<typeof ContextPagesResultSchema>;
export type ContextCookiesResult = z.output<typeof ContextCookiesResultSchema>;
export type ContextClipboardReadTextResult = z.output<typeof ContextClipboardReadTextResultSchema>;
export type ContextActivePageResult = z.output<typeof ContextActivePageResultSchema>;
export type ContextGetDomainPolicyResult = z.output<typeof ContextGetDomainPolicyResultSchema>;
export type PageUrlResult = z.output<typeof PageUrlResultSchema>;
export type PageTitleResult = z.output<typeof PageTitleResultSchema>;
export type PageCloseResult = z.output<typeof PageCloseResultSchema>;
export type PageEvaluateResult = z.output<typeof PageEvaluateResultSchema>;
export type PageScreenshotResult = z.output<typeof PageScreenshotResultSchema>;
export type PageWaitForSelectorResult = z.output<typeof PageWaitForSelectorResultSchema>;
export type LocatorClickResult = z.output<typeof LocatorClickResultSchema>;
export type LocatorFillResult = z.output<typeof LocatorFillResultSchema>;
export type LocatorHoverResult = z.output<typeof LocatorHoverResultSchema>;
export type LocatorCountResult = z.output<typeof LocatorCountResultSchema>;
export type LocatorIsCheckedResult = z.output<typeof LocatorIsCheckedResultSchema>;
export type LocatorInputValueResult = z.output<typeof LocatorInputValueResultSchema>;
export type LocatorIsVisibleResult = z.output<typeof LocatorIsVisibleResultSchema>;
export type LocatorInnerTextResult = z.output<typeof LocatorInnerTextResultSchema>;
export type LocatorInnerHtmlResult = z.output<typeof LocatorInnerHtmlResultSchema>;
export type LocatorTextContentResult = z.output<typeof LocatorTextContentResultSchema>;
export type LocatorScrollToResult = z.output<typeof LocatorScrollToResultSchema>;
export type LocatorCentroidResult = z.output<typeof LocatorCentroidResultSchema>;
export type LocatorHighlightResult = z.output<typeof LocatorHighlightResultSchema>;
export type LocatorSendClickEventResult = z.output<typeof LocatorSendClickEventResultSchema>;
export type LocatorTypeResult = z.output<typeof LocatorTypeResultSchema>;
export type LocatorSelectOptionResult = z.output<typeof LocatorSelectOptionResultSchema>;
export type LocatorSetInputFilesResult = z.output<typeof LocatorSetInputFilesResultSchema>;
export type StagehandLogData = z.output<typeof StagehandLogDataSchema>;
export type StagehandLog = z.output<typeof StagehandLogSchema>;
export type StagehandLogLevel = z.output<typeof StagehandLogLevelSchema>;
export type StagehandRpcRequest = z.output<typeof StagehandRpcRequestSchema>;
export type StagehandRpcNotification = z.output<typeof StagehandRpcNotificationSchema>;
export type StagehandMethod = z.output<typeof StagehandMethodSchema>;
export type StagehandSendToHostBinding = z.output<typeof StagehandSendToHostBindingSchema>;

export type ApiKeyAuth = z.output<typeof ApiKeyAuthSchema>;
export type BrowserSessionMetadata = z.output<typeof BrowserSessionMetadataSchema>;
export type BrowserbaseRegion = z.output<typeof BrowserbaseRegionSchema>;
export type BrowserbaseSessionCreateParams = z.output<typeof BrowserbaseSessionCreateParamsSchema>;
export type Caching = z.output<typeof CachingSchema>;
export type ClearCookieOptions = z.output<typeof ClearCookieOptionsSchema>;
export type ClientOptions = z.output<typeof ClientOptionsSchema>;
export type ClientOptionsBase = z.output<typeof ClientOptionsBaseSchema>;
export type Cookie = z.output<typeof CookieSchema>;
export type CookieFilter = z.output<typeof CookieFilterSchema>;
export type CookieParam = z.output<typeof CookieParamSchema>;
export type CookieRegex = z.output<typeof CookieRegexSchema>;
export type DomainPolicy = z.output<typeof DomainPolicySchema>;
export type LLMTool = z.output<typeof LLMToolSchema>;
export type LoadState = z.output<typeof LoadStateSchema>;
export type LocalBrowserLaunchOptions = z.output<typeof LocalBrowserLaunchOptionsSchema>;
export type ModelAuth = z.output<typeof ModelAuthSchema>;
export type ModelProviderOptions = z.output<typeof ModelProviderOptionsSchema>;
export type ThinkingEffort = z.output<typeof ThinkingEffortSchema>;

export type BrowserbaseBrowserSettings = z.output<typeof BrowserbaseBrowserSettingsSchema>;
export type BrowserbaseContext = z.output<typeof BrowserbaseContextSchema>;
export type BrowserbaseFingerprint = z.output<typeof BrowserbaseFingerprintSchema>;
export type BrowserbaseFingerprintScreen = z.output<typeof BrowserbaseFingerprintScreenSchema>;
export type BrowserbaseProxyConfig = z.output<typeof BrowserbaseProxyConfigSchema>;
export type BrowserbaseProxyGeolocation = z.output<typeof BrowserbaseProxyGeolocationSchema>;
export type BrowserbaseViewport = z.output<typeof BrowserbaseViewportSchema>;
export type ExternalProxyConfig = z.output<typeof ExternalProxyConfigSchema>;
export type ProxyConfig = z.output<typeof ProxyConfigSchema>;
