import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EnvironmentSettings, ViewTitleService } from '@polygon/core';
import { HelloWorldComponent } from './hello-world.component';

describe('HelloWorldComponent', () => {
	let component: HelloWorldComponent;
	let fixture: ComponentFixture<HelloWorldComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [HelloWorldComponent],
			providers: [
				{
					provide: EnvironmentSettings,
					useValue: {
						productName: 'Test Product'
					}
				},
				{
					provide: ViewTitleService,
					useValue: {
						setViewTitleMetadata: jasmine.createSpy('setViewTitleMetadata')
					}
				}
			]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(HelloWorldComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should render title', () => {
		const fixture = TestBed.createComponent(HelloWorldComponent);
		fixture.detectChanges();
		const compiled = fixture.nativeElement;

		expect(compiled.querySelector('.product-name').textContent).toContain('Test Product');
	});
});
