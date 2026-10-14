declare module 'graphql-upload/GraphQLUpload.js' {
  import { GraphQLScalarType } from 'graphql';
  const scalar: GraphQLScalarType;
  export = scalar;
}
declare module 'graphql-upload/graphqlUploadExpress.js' {
  import { RequestHandler } from 'express';
  function middleware(options?: { maxFieldSize?: number; maxFileSize?: number; maxFiles?: number }): RequestHandler;
  export = middleware;
}
