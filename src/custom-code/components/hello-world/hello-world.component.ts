import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { EnvironmentSettings, OutletEnum, ViewTitleService } from '@polygon/core';

@Component({
	selector: 'app-hello-world',
	templateUrl: './hello-world.component.html',
	styleUrls: ['./hello-world.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None
})
export class HelloWorldComponent {
	productName = '';
	private readonly environmentService: EnvironmentSettings = inject(EnvironmentSettings);
	private readonly viewTitleService: ViewTitleService = inject(ViewTitleService);

	constructor() {
		this.productName = this.environmentService.productName;
		this.viewTitleService.setViewTitleMetadata({
			outlet: OutletEnum.Primary,
			title: this.environmentService.productName
		});
	}
}
