import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger('API');
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const start = Date.now();
		const operation =
			context.getType<string>() === 'graphql'
				? GqlExecutionContext.create(context).getInfo().fieldName
				: context.getType();
		return next.handle().pipe(tap(() => this.logger.log(`${operation} ${Date.now() - start}ms`)));
	}
}
