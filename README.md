# Polygon ClientApp

Angular application which handles the presentation layer of the framework architecture.

> _NOTE:_ This file is auto-generated. Any change will be overridden.

## Index

1. [How to install](#how-to-install)
2. [How to run](#how-to-run)
3. [Architecture](#architecture)
    - [custom-code](#custom-code)
        - [assets](#assets)
            - [configurations](#configurations)
            - [i18n](#i18n)
            - [images](#images)
        - [environments](#environments)
        - [styles](#styles)
        - [custom.components.ts](#customcomponentsts)
        - [custom.headers.ts](#customheadersts)
        - [custom.modules.ts](#custommodulests)
        - [custom.services.ts](#customservicests)
    - [generated-code](#generated-code)
4. [FAQs](#faqs)
5. [Troubleshooting](#troubleshooting)

---

## How to install

This section contains a set of instructions in order to install properly this project.

### Project setup

For setting up the project, please follow the following steps:

1. Install `node version ^24.11.1` (equals or greater)
    1. To check your version, in the console, type `node -v`
    2. To install the supported version go [here](https://nodejs.org/en/download/releases).
2. Run `npm cache clean --force`
3. Run `npm i`
4. Open the Windows Certificate Manager by following these steps:
    1. Press `Win + R`
    2. Enter `certlm.msc`
    3. Press `Enter` to open the Certificate Manager
5. On the Certificate Manager:
    1. Right click on `Trusted Root Certification Authorities` on the left panel and select `All Tasks > Import...`
    2. Choose `Local Machine` and click `Next >`
    3. Browse for the `/src/generated-code/ssl`, open the `localhost.crt` file and select `Next`
    4. Choose `Place all certificates in the following store`, make sure it is set as `Trusted Root Certification Authorities`, click `Next` and then `Finish`
6. Restart your browser
7. The client app is now ready to be started on [`https://localhost:4200`](https://localhost:4200).

### Package dependency installation

After setting up the project, you can install the package dependencies running `npm i` in the console terminal.

_Note:_ If you are experiencing installation problems and you want to reinstall all the packages, run `npm run reinstall`. _This removes the node_modules packages and reinstalls them_.

---

## How to run

_Before running the project, be sure you [setup](#project-setup) and install all [package dependencies](#package-dependency-installation)!_

This project can run in two different modes: [debug](#debug-mode) and [build](#build-mode). The debug mode should be used for development purposes and the build mode for deployment purposes.

### Debug mode

To run the project in development mode, run the command `npm run debug` in the console terminal. The project will create a node server, which will be available through [`https://localhost:4200`](https://localhost:4200).

Also, the node server will reload automatically each time a change is made.

#### Debugging tips

If you are developing only front-end components, you can configure `environment.debug.ts` to directly communicate with the online server API without compiling and running the server side on your computer: is faster and more productive.

### Build mode

To run the project in build mode, run the command `npm run build` in the console terminal. The build artifacts will be placed inside the `dist` folder.

You can then serve the client application using a [node server](https://www.npmjs.com/package/http-server) or using a [static web app](https://docs.microsoft.com/en-us/azure/static-web-apps/overview).

---

## Architecture

This section will explain the folder disposition and which content is inside of each one.

⚠️ We strongly advise you to only change code inside the custom-code folder. Nevertheless, for some level of customization, it will be required to change other files such as `package.json`, `tsconfig.**.json` and `angular.json`. This files are considered common ground between products and framework and any change should be carefully measured since it could lead to erratic behavior. Moreover, these files will suffer changes during time, that will be well described in the release notes.

### custom-code

This folder contains a set of files allowing some level of customization. The following section will explain in detail how to configure such customizations.

#### assets

All files present on this folder will be available under `${domain}/assets/**/*.${filename}`. For example, the application loader can be accessed through [`https://localhost:4200/assets/images/loader.gif`](https://localhost:4200/assets/images/loader.gif).

Feel free to add here any file you want to access in one of your custom components.

##### **configurations**

This folder contains a set of files allowing to define several application configurations such as `context pages`, `custom views`, `i18n` (localizations) and `dashboards`.

##### **i18n**

This folder contains a group of files distributed by different cultures, allowing to show multiple information according to the user culture.

##### **images**

You can override all images used by default by placing in here new images with same name as the default ones. Also, you can place here any new image in order to be accessed in one of your custom components. Then, you can use them like this:

```html
<img src="/assets/images/{your-image}" />
```

#### components

Here you can add your application standalone components.

#### environments

In here you can find a set of environment files allowing to set different settings for different environments. You can create as many as you want, but we recommend setting the following structure:

```bash
environments
├── debug
|   ├── environment.json
|
├── deploys
	├── env.dv.json
	├── env.st.json
	├── env.pd.json
```

#### styles

This folder is responsible for handling any custom styles definition. At the moment, the only customization option available is for the loader component. You can do this through the 'loader.scss' file.

⚠️ Be careful when defining custom styles! From now on, all product themes must adhere to the Cegid Design System.

#### custom.routes.ts

Here you can define your custom routes that will be loaded by the application.

```typescript
import { Routes } from '@angular/router';

export const customRoutes: Routes = [
	{
		path: 'home',
		loadComponent: () => import('./components/hello-world/hello-world.component').then((c) => c.HelloWorldComponent)
	},
	{
		path: 'contacts',
		loadComponent: () => import('./components/contacts/contacts.component').then((c) => c.ContactsComponent)
	},
	{ path: '**', redirectTo: 'home' }
];
```

#### custom.services.ts

Here you can import any custom service.

```typescript
import { Provider } from '@angular/core';
import { CustomService, AnotherCustomService } from '@product/example';

export const customServices: Provider[] = [CustomService, AnotherCustomService];
```

### generated-code

All files inside this folder are generated each time the project is compiled (on both `debug` and `build` modes). You can always force the re-generation of this folder by running the command `ng g @polygon/schematics:generated-code`.

---

##### _Review date: 10/11/2025_

##### _@ Polygon_

##### _© Cegid_
