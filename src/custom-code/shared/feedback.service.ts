import { inject, Injectable, signal } from '@angular/core';
import {
	DialogCancelAction,
	DialogMainAction,
	DialogMainActionType,
	DialogOptions,
	DialogService,
	StatusEnum,
	ToastMessageService
} from '@polygon/components';
import { Translator } from './translator.service';

export interface ConfirmOptions {
	title: string;
	description: string;
	confirmLabel: string;
	/** Styles the confirm button as a destructive action (delete). */
	destructive?: boolean;
}

/** Thin wrapper over the Polygon toast and dialog services, so screens give feedback in one line. */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
	private readonly dialogService = inject(DialogService);
	private readonly toastService = inject(ToastMessageService);
	private readonly translator = inject(Translator);

	success(message: string): void {
		this.toastService.show({ message, type: StatusEnum.Success });
	}

	error(message: string): void {
		this.toastService.show({ message, type: StatusEnum.Error });
	}

	/** Asks for confirmation and runs `onConfirm` only if the user accepts. */
	confirm(options: ConfirmOptions, onConfirm: () => void | Promise<void>): void {
		this.dialogService.toggleDialog(
			new DialogOptions({
				// The dialog service closes a dialog opened twice with the same id, so every call gets its own.
				id: `qapulse-confirm-${Date.now()}`,
				title: signal(options.title),
				description: signal(options.description),
				// Without an explicit action, Cancel just closes the dialog.
				cancelAction: signal(new DialogCancelAction({ label: signal(this.translator.t('Common_Cancel')) })),
				mainAction: signal(
					new DialogMainAction({
						label: signal(options.confirmLabel),
						type: options.destructive
							? DialogMainActionType.Destructive
							: DialogMainActionType.Confirmation,
						action: () => {
							this.dialogService.toggleDialog();
							void onConfirm();
						}
					})
				)
			})
		);
	}
}
