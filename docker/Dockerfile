FROM amazonlinux:2

RUN yum update -y
RUN yum install -y tar gzip git
RUN yum groupinstall 'Development Tools' -y

RUN curl --silent --location https://rpm.nodesource.com/setup_20.x | bash -
RUN yum -y install nodejs gcc-c++ make
RUN npm install -g runjs node-gyp node-pre-gyp
RUN npm install -g https://github.com/fromkeith/runlam.git#cb7ac64d941be02f8d30b4afcc85959a217983b0

